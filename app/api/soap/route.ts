import { detectIdentifiers } from "@/lib/pii";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 20000;

const SYSTEM_PROMPT = `You are a formatting assistant for anonymised clinical text.

Task: Restructure ONLY the provided text into a clinical note in a SOAP-like structure.

Rules (must follow):
- Do NOT add new medical facts.
- Do NOT infer or suggest diagnoses.
- Do NOT introduce medications, dosages, test results, symptoms, or history that are not explicitly present in the input.
- Use ONLY information explicitly contained in the input text.
- Output MUST use exactly the section headers specified by the user instructions (language-dependent) and in the specified order.
- If information for a section is missing, leave that section blank (keep the header).
- Preserve clinical meaning while improving structure and clarity.
- Do NOT include any patient identifiers.
- Output only the SOAP note; no additional commentary.
`;

function json(
  body: unknown,
  init?: Omit<ResponseInit, "headers"> & { headers?: Record<string, string> }
) {
  return Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers || {})
    }
  });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ errorKey: "invalid_json", error: "Invalid JSON." }, { status: 400 });
  }

  const obj = (payload as { text?: unknown; language?: unknown } | null) ?? null;
  const text = typeof obj?.text === "string" ? (obj.text ?? "") : "";
  const language = obj?.language === "en" ? "en" : "sv";

  if (!text.trim()) {
    return json(
      {
        errorKey: "text_required",
        error: language === "sv" ? "Text krävs." : "Text is required."
      },
      { status: 400 }
    );
  }

  if (text.length > MAX_CHARS) {
    return json(
      {
        errorKey: "text_too_long",
        error: language === "sv" ? "Texten är för lång." : "Text too long."
      },
      { status: 413 }
    );
  }

  const detection = detectIdentifiers(text);
  if (detection.hasIdentifiers) {
    const ageLike = detection.matches.find((m) => m.reason === "precise_age");
    const nameLike = detection.matches.find((m) =>
      ["full_name", "initial_last_name", "name_label", "name_tag", "name_in_prose"].includes(m.reason)
    );
    const dateLike = detection.matches.find((m) => m.reason === "date");
    const temporalLike = detection.matches.find((m) => m.reason === "temporal_reference");
    const detail =
      ageLike?.match
        ? language === "sv"
          ? `Exakt ålder upptäckt: ${ageLike.match}`
          : `Precise age detected: ${ageLike.match}`
        : nameLike?.match
        ? language === "sv"
          ? `Namn upptäckt: ${nameLike.match}`
          : `Name detected: ${nameLike.match}`
        : dateLike?.match
          ? language === "sv"
            ? `Datum upptäckt: ${dateLike.match}`
            : `Date detected: ${dateLike.match}`
          : temporalLike?.match
            ? language === "sv"
              ? `Tidsreferens upptäckt: ${temporalLike.match}`
              : `Temporal reference detected: ${temporalLike.match}`
        : detection.matches[0]?.match
          ? language === "sv"
            ? `Identifierare upptäckt: ${detection.matches[0].match}`
            : `Identifier detected: ${detection.matches[0].match}`
          : undefined;

    const baseError = ageLike
      ? language === "sv"
        ? "Texten innehåller en exakt ålder. Byt ut exakt ålder mot ett intervall/decennium eller beskrivning och försök igen (t.ex. “i 40-årsåldern”, “20–30”, “yngre”, “medelålders”, “äldre”)."
        : "Input contains a precise age. Replace exact age with a range/decade or a descriptor and try again (e.g. “in their 40s”, “20–30”, “young”, “middle-aged”, “older”)."
      : language === "sv"
        ? "Texten verkar innehålla patientidentifierare. Ta bort identifierare och försök igen."
        : "Input appears to contain patient identifiers. Remove identifiers and try again.";

    return json(
      {
        errorKey: "pii_detected",
        error:
          baseError +
          (detail ? ` (${detail})` : ""),
        reasons: detection.reasons,
        detected: detection.matches
      },
      { status: 400 }
    );
  }

  try {
    const client = getOpenAIClient();
    const userInstruction =
      language === "sv"
        ? `Skriv på svenska med normal svensk klinisk journalstil.\n\nSpråkkrav: Utdatan MÅSTE vara på svenska. Om indata är på engelska, översätt den till svenska utan att lägga till nya fakta.\n\nAnvänd exakt dessa rubriker i denna ordning (inga andra rubriker):\nAnamnes / Patientupplevelse:\nStatus / Observationer:\nBedömning:\nPlan / Åtgärder:\n\nOm information saknas, lämna avsnittet tomt (behåll rubriken).`
        : `Write in English in a clinical note style.\n\nLanguage requirement: Output MUST be in English. If the input is in Swedish, translate it to English while preserving meaning and without adding any new facts.\n\nUse exactly these section headers in this order (no other headers):\nSubjective:\nObjective:\nAssessment:\nPlan:\n\nIf information is missing, leave that section blank (keep the header).`;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${userInstruction}\n\n---\n\n${text}` }
      ]
    });

    const soap = response.choices?.[0]?.message?.content || "";
    return json({ soap }, { status: 200 });
  } catch (err) {
    // Log server-side for debugging. We keep the client-facing error generic in production.
    console.error("OpenAI upstream formatting failed:", err);

    const anyErr = err as unknown as {
      name?: unknown;
      message?: unknown;
      status?: unknown;
      code?: unknown;
      type?: unknown;
      error?: unknown;
    };

    const status = typeof anyErr?.status === "number" ? anyErr.status : undefined;
    const code =
      typeof anyErr?.code === "string"
        ? anyErr.code
        : typeof (anyErr as any)?.error?.code === "string"
          ? ((anyErr as any).error.code as string)
          : undefined;
    const type =
      typeof anyErr?.type === "string"
        ? anyErr.type
        : typeof (anyErr as any)?.error?.type === "string"
          ? ((anyErr as any).error.type as string)
          : undefined;

    let errorKey:
      | "upstream_failed"
      | "insufficient_quota"
      | "rate_limited"
      | "auth_failed" = "upstream_failed";
    let httpStatus = 502;

    if (status === 429) {
      httpStatus = 429;
      errorKey = code === "insufficient_quota" || type === "insufficient_quota" ? "insufficient_quota" : "rate_limited";
    } else if (status === 401 || status === 403) {
      httpStatus = 401;
      errorKey = "auth_failed";
    }

    const debug =
      process.env.NODE_ENV === "development"
        ? {
            name: typeof anyErr?.name === "string" ? anyErr.name : undefined,
            message:
              typeof anyErr?.message === "string"
                ? anyErr.message
                : err instanceof Error
                  ? err.message
                  : String(err),
            status,
            code,
            type
          }
        : undefined;

    return json(
      {
        errorKey,
        error:
          language === "sv"
            ? errorKey === "insufficient_quota"
              ? "Slut på API-krediter/quota för denna OpenAI-nyckel. Kontrollera Billing/Usage i OpenAI."
              : errorKey === "rate_limited"
                ? "För många anrop på kort tid (rate limit). Försök igen om en stund."
                : errorKey === "auth_failed"
                  ? "API-nyckeln nekades (401/403). Kontrollera att nyckeln är korrekt och att projektet har API-åtkomst."
                  : "Formatering misslyckades."
            : errorKey === "insufficient_quota"
              ? "Out of API credits/quota for this OpenAI key. Check Billing/Usage in OpenAI."
              : errorKey === "rate_limited"
                ? "Too many requests (rate limit). Try again shortly."
                : errorKey === "auth_failed"
                  ? "API key was rejected (401/403). Check the key and project access."
                  : "Upstream formatting failed."
        ,
        ...(debug ? { debug } : {})
      },
      { status: httpStatus }
    );
  }
}


