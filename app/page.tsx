"use client";

import { useMemo, useState } from "react";

type ApiSuccess = { soap: string };
type ApiError = { error: string; reasons?: string[] };

type UiLang = "sv" | "en";

function getOutputTemplate(lang: UiLang): string {
  if (lang === "en") {
    return "Subjective:\n\nObjective:\n\nAssessment:\n\nPlan:\n";
  }
  return "Anamnes / Patientupplevelse:\n\nStatus / Observationer:\n\nBedömning:\n\nPlan / Åtgärder:\n";
}

export default function Page() {
  const [lang, setLang] = useState<UiLang>("sv");
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soap, setSoap] = useState<string>("");
  const [error, setError] = useState<string>("");

  const copy = useMemo(() => {
    const isSv = lang === "sv";
    return {
      appTag: isSv ? "Anonymiserad, stateless formatterare" : "Anonymised, stateless formatter",
      title: "ClinicalNoteTool",
      subtitle: isSv
        ? "Klistra in anonymiserad klinisk text och få den omstrukturerad till en klinisk anteckning. Verktyget är stateless: ingen lagring, ingen historik, ingen inloggning."
        : "Paste anonymised clinical text and get it restructured into a clinical note. Stateless: no storage, no history, no authentication.",
      disclaimer: isSv ? "Inte ett journalsystem. Inte en medicinteknisk produkt." : "Not a hospital system. Not a medical device.",
      warningTitle: isSv ? "Inkludera INTE patientidentifierare" : "Do NOT include patient identifiers",
      warningBody: isSv
        ? "Bearbetning blockeras om identifierare upptäcks (datum, fullständiga namn, svenska personnummer)."
        : "Processing is hard-blocked if identifiers are detected (dates, full names, Swedish personal numbers).",
      inputLabel: isSv ? "Anonymiserad klinisk text" : "Anonymised clinical text",
      inputPlaceholder: isSv ? "Skriv in anonymiserad klinisk text här…" : "Enter anonymised clinical text here…",
      confirm: isSv
        ? "Jag bekräftar att texten inte innehåller patientidentifierare"
        : "I confirm this text contains no patient identifiers",
      submit: isSv ? "Skapa anteckning" : "Generate note",
      submitting: isSv ? "Formaterar…" : "Formatting…",
      helper: isSv ? "Texten avvisas om identifierare upptäcks." : "Input is rejected if identifiers are detected.",
      outputTitle: isSv ? "Utkast" : "Draft",
      noStorage: isSv ? "Ingen lagring" : "No storage",
      networkError: isSv ? "Nätverksfel." : "Network error.",
      rejectedFallback: isSv ? "Begäran avvisades." : "Request rejected."
    };
  }, [lang]);

  const canSubmit = useMemo(() => {
    return confirmed && text.trim().length > 0 && !isSubmitting;
  }, [confirmed, text, isSubmitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSoap("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/soap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, language: lang })
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        const base = data?.error || copy.rejectedFallback;
        setError(base);
        return;
      }

      const data = (await res.json()) as ApiSuccess;
      setSoap(data.soap || "");
    } catch {
      setError(copy.networkError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(80rem_60rem_at_20%_-10%,rgba(251,191,36,0.20),transparent_60%),radial-gradient(70rem_50rem_at_90%_10%,rgba(16,185,129,0.14),transparent_55%),linear-gradient(to_bottom,rgba(255,251,235,0.75),rgba(255,255,255,1))]">
      {/* Decorative shapes (no blue/purple gradients) */}
      <div
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-300/20 blur-2xl animate-float-slow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 top-24 h-80 w-80 rounded-full bg-emerald-300/15 blur-2xl animate-float-slow [animation-delay:1200ms]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 animate-fade-up">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {copy.appTag}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {copy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {copy.subtitle}
              </p>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex rounded-xl border border-slate-200 bg-white/70 p-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur"
                  role="tablist"
                  aria-label="Language"
                >
                  <button
                    type="button"
                    onClick={() => setLang("sv")}
                    className={`rounded-lg px-3 py-1 transition ${
                      lang === "sv"
                        ? "bg-amber-100 text-slate-900 shadow-sm"
                        : "hover:bg-slate-50"
                    }`}
                    aria-pressed={lang === "sv"}
                  >
                    Svenska
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`rounded-lg px-3 py-1 transition ${
                      lang === "en"
                        ? "bg-amber-100 text-slate-900 shadow-sm"
                        : "hover:bg-slate-50"
                    }`}
                    aria-pressed={lang === "en"}
                  >
                    English
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
                  {copy.disclaimer}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-amber-200 bg-white/70 px-4 py-3 text-amber-950 shadow-sm backdrop-blur animate-fade-up [animation-delay:70ms]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-amber-100 p-1 shadow-sm">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-amber-800"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 6a1 1 0 112 0v5a1 1 0 11-2 0V6zm1 9a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">
                {copy.warningTitle}
              </p>
              <p className="mt-1 text-xs text-amber-900/80">
                {copy.warningBody}
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-up [animation-delay:140ms]">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="clinicalText"
                className="text-sm font-semibold text-slate-900"
              >
                {copy.inputLabel}
              </label>
              <span className="text-xs text-slate-500">
                {text.trim().length} chars
              </span>
            </div>

            <textarea
              id="clinicalText"
              name="clinicalText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              className="mt-3 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
              placeholder={copy.inputPlaceholder}
            />

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-start gap-2">
                <input
                  id="confirmNoIdentifiers"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-200"
                />
                <label
                  htmlFor="confirmNoIdentifiers"
                  className="text-sm text-slate-700"
                >
                  {copy.confirm}
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900/40 border-t-slate-900" />
                    {copy.submitting}
                  </>
                ) : (
                  copy.submit
                )}
              </button>
              <p className="text-xs text-slate-600">
                {copy.helper}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-up [animation-delay:210ms]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {copy.outputTitle}
              </h2>
              <span className="text-xs text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {copy.noStorage}
                </span>
              </span>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 animate-fade-in">
                {error}
              </div>
            ) : null}

            <pre className="mt-3 min-h-[24rem] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900">
              {soap ? (
                <span className="animate-fade-in">{soap}</span>
              ) : (
                getOutputTemplate(lang)
              )}
            </pre>
          </section>
        </form>

        <footer className="mt-8 text-xs text-slate-500 sm:hidden">
          <div className="flex flex-col gap-3">
            <div
              className="inline-flex w-fit rounded-xl border border-slate-200 bg-white/70 p-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur"
              role="tablist"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLang("sv")}
                className={`rounded-lg px-3 py-1 transition ${
                  lang === "sv"
                    ? "bg-amber-100 text-slate-900 shadow-sm"
                    : "hover:bg-slate-50"
                }`}
                aria-pressed={lang === "sv"}
              >
                Svenska
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-lg px-3 py-1 transition ${
                  lang === "en"
                    ? "bg-amber-100 text-slate-900 shadow-sm"
                    : "hover:bg-slate-50"
                }`}
                aria-pressed={lang === "en"}
              >
                English
              </button>
            </div>
            <div>{copy.disclaimer}</div>
          </div>
        </footer>
      </div>
    </main>
  );
}


