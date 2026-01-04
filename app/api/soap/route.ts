import { detectIdentifiers } from "@/lib/pii";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 20000;

export const SYSTEM_PROMPT = `You are a formatting assistant for anonymised clinical text.

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
    return json({ error: "Invalid JSON." }, { status: 400 });
  }

  const obj = (payload as { text?: unknown; language?: unknown } | null) ?? null;
  const text = typeof obj?.text === "string" ? (obj.text ?? "") : "";
  const language = obj?.language === "en" ? "en" : "sv";

  if (!text.trim()) {
    return json(
      { error: language === "sv" ? "Text krävs." : "Text is required." },
      { status: 400 }
    );
  }

  if (text.length > MAX_CHARS) {
    return json(
      { error: language === "sv" ? "Texten är för lång." : "Text too long." },
      { status: 413 }
    );
  }

  const detection = detectIdentifiers(text);
  if (detection.hasIdentifiers) {
    return json(
      {
        error:
          language === "sv"
            ? "Texten verkar innehålla patientidentifierare. Ta bort identifierare och försök igen."
            : "Input appears to contain patient identifiers. Remove identifiers and try again.",
        reasons: detection.reasons
      },
      { status: 400 }
    );
  }

  try {
    const client = getOpenAIClient();
    const userInstruction =
      language === "sv"
        ? `Skriv på svenska med normal svensk klinisk journalstil.\n\nAnvänd exakt dessa rubriker i denna ordning (inga andra rubriker):\nAnamnes / Patientupplevelse:\nStatus / Observationer:\nBedömning:\nPlan / Åtgärder:\n\nOm information saknas, lämna avsnittet tomt (behåll rubriken).`
        : `Write in English in a clinical note style.\n\nUse exactly these section headers in this order (no other headers):\nSubjective:\nObjective:\nAssessment:\nPlan:\n\nIf information is missing, leave that section blank (keep the header).`;
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }]
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: userInstruction },
            { type: "input_text", text: "\n\n---\n\n" },
            { type: "input_text", text }
          ]
        }
      ]
    });

    const soap = response.output_text || "";
    return json({ soap }, { status: 200 });
  } catch {
    return json(
      {
        error:
          language === "sv"
            ? "Formatering misslyckades."
            : "Upstream formatting failed."
      },
      { status: 502 }
    );
  }
}


