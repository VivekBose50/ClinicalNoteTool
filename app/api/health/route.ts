export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  return json(
    {
      ok: true,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      hasOpenAIKey: Boolean(key),
      openAIKeyLooksLikeSk: typeof key === "string" ? key.trim().startsWith("sk-") : false,
      openAIKeyLength: typeof key === "string" ? key.trim().length : 0
    },
    { status: 200 }
  );
}


