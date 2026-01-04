export type IdentifierReason = "date" | "full_name" | "swedish_personal_number";

export type IdentifierDetectionResult = {
  hasIdentifiers: boolean;
  reasons: IdentifierReason[];
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function detectSwedishPersonalNumber(text: string): boolean {
  // Swedish personal number (strict per requirement): YYYYMMDD-XXXX
  const re = /\b(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-\d{4}\b/g;
  return re.test(text);
}

function detectDates(text: string): boolean {
  // Strict: block common date formats and date-like tokens.
  const patterns: RegExp[] = [
    // 2026-01-04 / 2026/01/04
    /\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g,
    // 04/01/2026 or 04-01-26 (DD/MM/YYYY|YY) and MM/DD/YYYY|YY
    /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](\d{2}|\d{4})\b/g,
    // 4 Jan 2026 / 04 January 26
    /\b(0?[1-9]|[12]\d|3[01])\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{2}|\d{4})\b/gi,
    // Jan 4, 2026
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01])(?:,)?\s+(\d{2}|\d{4})\b/gi
  ];

  return patterns.some((re) => re.test(text));
}

function detectFullNames(text: string): boolean {
  // Strict heuristic: 2-3 consecutive capitalized tokens (supports Swedish letters), optional hyphenation.
  // Note: this will generate false positives by design; strict hard-blocking is preferred.
  const re =
    /\b[\p{Lu}][\p{L}]+(?:-[\p{Lu}][\p{L}]+)?\s+[\p{Lu}][\p{L}]+(?:-[\p{Lu}][\p{L}]+)?(?:\s+[\p{Lu}][\p{L}]+)?\b/gu;
  return re.test(text);
}

export function detectIdentifiers(text: string): IdentifierDetectionResult {
  const reasons: IdentifierReason[] = [];

  if (detectSwedishPersonalNumber(text)) reasons.push("swedish_personal_number");
  if (detectDates(text)) reasons.push("date");
  if (detectFullNames(text)) reasons.push("full_name");

  const unique = uniq(reasons);
  return { hasIdentifiers: unique.length > 0, reasons: unique };
}


