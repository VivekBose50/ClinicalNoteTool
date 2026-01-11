export type IdentifierReason =
  | "full_name"
  | "initial_last_name"
  | "name_label"
  | "name_tag"
  | "name_in_prose"
  | "date"
  | "temporal_reference"
  | "precise_age"
  | "swedish_personal_number"
  | "patient_id_or_journal_number"
  | "email"
  | "phone_number"
  | "address"
  | "ward_bed_timestamp";

export type IdentifierMatch = {
  reason: IdentifierReason;
  match: string;
};

export type IdentifierDetectionResult = {
  hasIdentifiers: boolean;
  reasons: IdentifierReason[];
  matches: IdentifierMatch[];
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function firstRegexMatch(text: string, re: RegExp): string | null {
  // We want the first *matched substring* for UX feedback.
  // `re` is expected to be global (`/g`) so we can use matchAll reliably.
  for (const m of text.matchAll(re)) {
    const hit = m[0];
    if (hit) return hit;
  }
  return null;
}

function detectSwedishPersonalNumber(text: string): string | null {
  // Swedish personal number (personnummer / samordningsnummer).
  // Accepts YYMMDD-XXXX / YYMMDD+XXXX / YYYYMMDD-XXXX / YYYYMMDD+XXXX
  // (Validation like Luhn/checksum intentionally omitted; we only need a strong indicator.)
  const re =
    /\b(?:\d{2}|\d{4})(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[-+]\d{4}\b/g;
  return firstRegexMatch(text, re);
}

function detectDate(text: string): string | null {
  // NOTE: This intentionally blocks *general* date formats, including any month-name mention,
  // per product requirement. This will also catch phrases like "in May".
  //
  // Numeric date formats (common variants):
  // - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  // - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  // - MM-DD-YYYY (US-style), MM/DD/YYYY, MM.DD.YYYY
  const isoLikeRe =
    /\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b/g;
  const dmyRe =
    /\b(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b/g;
  const mdyRe =
    /\b(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:19|20)\d{2}\b/g;

  const numeric = firstRegexMatch(text, isoLikeRe) || firstRegexMatch(text, dmyRe) || firstRegexMatch(text, mdyRe);
  if (numeric) return numeric;

  // Month name mention (EN + SV, full + common abbreviations)
  const monthRe =
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|okt|sep|aug|jun|jul|dec|nov|mar|apr)\b/gi;
  return firstRegexMatch(text, monthRe);
}

function detectTemporalReference(text: string): string | null {
  // Blocks *any* date/time reference, including relative language ("yesterday", "last month", "24th", etc.)
  // as requested. This is intentionally strict and may reject some clinical phrasing.
  //
  // Order matters: prefer more specific matches first.

  // Clock times: 14:30, 2pm, 2 pm, 02:15
  const time24hRe = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g;
  const timeAmPmRe = /\b(?:0?[1-9]|1[0-2])\s?(?:am|pm)\b/gi;
  const timeWordsRe =
    /\b(?:noon|midnight|tonight|overnight|last\s+night|yesterday\s+night)\b/gi;
  const timeOfDayRe =
    /\b(?:during|in|at|on)\s+(?:the\s+)?(?:night|morning|afternoon|evening)\b/gi;
  const timeRangeRe =
    /\b(?:earlier|later)\s+(?:today|tonight|this\s+morning|this\s+afternoon|this\s+evening)\b/gi;
  const timeOfDayBareRe = /\b(?:morning|afternoon|evening|night)\b/gi;
  const timeWordsSvRe =
    /\b(?:i\s+natt|ikv[äa]ll|i\s+morse|i\s+morgon|i\s+kv[äa]ll|ig[åa]r\s+kv[äa]ll|ig[åa]r\s+natt|kl\.?\s*\d{1,2}(?::[0-5]\d)?)\b/gi;
  const timeOfDaySvRe =
    /\b(?:under|p[åa])\s+(?:natten|morgonen|f[öo]rmiddagen|eftermiddagen|kv[äa]llen|dagen)\b/gi;
  const timeOfDayBareSvRe =
    /\b(?:morgon|f[öo]rmiddag|eftermiddag|kv[äa]ll|natt|natten|morgonen|f[öo]rmiddagen|eftermiddagen|kv[äa]llen)\b/gi;

  const t =
    firstRegexMatch(text, timeWordsRe) ||
    firstRegexMatch(text, timeOfDayRe) ||
    firstRegexMatch(text, timeRangeRe) ||
    firstRegexMatch(text, timeOfDayBareRe) ||
    firstRegexMatch(text, timeWordsSvRe) ||
    firstRegexMatch(text, timeOfDaySvRe) ||
    firstRegexMatch(text, timeOfDayBareSvRe) ||
    firstRegexMatch(text, time24hRe) ||
    firstRegexMatch(text, timeAmPmRe);
  if (t) return t;

  // Relative day/month/year references
  const relativeRe =
    /\b(?:today|yesterday|tomorrow|day\s+before\s+yesterday|day\s+after\s+tomorrow|recently|earlier|later|last\s+(?:night|week|month|year)|next\s+(?:week|month|year)|this\s+(?:week|month|year))\b/gi;
  const relativeSvRe =
    /\b(?:idag|ig[åa]r|imorgon|f[öo]rrg[åa]r|[öo]vermorgon|nyligen|tidigare|senare|f[öo]rra\s+(?:veckan|m[åa]naden|[åa]ret)|n[äa]sta\s+(?:vecka|m[åa]nad|[åa]r)|denna\s+(?:vecka|m[åa]nad|[åa]r))\b/gi;
  const rel = firstRegexMatch(text, relativeRe) || firstRegexMatch(text, relativeSvRe);
  if (rel) return rel;

  // Weekday references like "last Friday", "next Monday", "on Tuesday"
  const weekdayRe =
    /\b(?:last|next|this|on)\s+(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:sday)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi;
  const weekdaySvRe =
    /\b(?:f[öo]rra|n[äa]sta|denna|p[åa])\s+(?:m[åa]ndag|tisdag|onsdag|torsdag|fredag|l[öo]rdag|s[öo]ndag)\b/gi;
  const wd = firstRegexMatch(text, weekdayRe) || firstRegexMatch(text, weekdaySvRe);
  if (wd) return wd;

  // Standalone weekday mentions (e.g. "monday" / "måndag") should also be blocked.
  const weekdayBareRe =
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon\.?|tue\.?|tues\.?|wed\.?|thu\.?|thur\.?|thurs\.?|fri\.?|sat\.?|sun\.?)\b/gi;
  const weekdayBareSvRe =
    /\b(?:m[åa]ndag|tisdag|onsdag|torsdag|fredag|l[öo]rdag|s[öo]ndag|m[åa]n\.?|tis\.?|ons\.?|tors\.?|fre\.?|l[öo]r\.?|s[öo]n\.?)\b/gi;
  const wdBare = firstRegexMatch(text, weekdayBareRe) || firstRegexMatch(text, weekdayBareSvRe);
  if (wdBare) return wdBare;

  // Ordinal day-of-month like "24th" (also blocks "1st", "2nd", etc.)
  const ordinalRe = /\b(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)\b/gi;
  const ord = firstRegexMatch(text, ordinalRe);
  if (ord) return ord;

  // Relative numeric durations: "2 days ago", "in 3 weeks", "for 4 months"
  const durationRe =
    /\b(?:in\s+\d+\s+(?:day|days|week|weeks|month|months|year|years)|\d+\s+(?:day|days|week|weeks|month|months|year|years)\s+ago)\b/gi;
  const durationSvRe =
    /\b(?:om\s+\d+\s+(?:dag|dagar|vecka|veckor|m[åa]nad|m[åa]nader|[åa]r)|f[öo]r\s+\d+\s+(?:dag|dagar|vecka|veckor|m[åa]nad|m[åa]nader|[åa]r)\s+sedan)\b/gi;
  const dur = firstRegexMatch(text, durationRe) || firstRegexMatch(text, durationSvRe);
  if (dur) return dur;

  // "last month" variants with ordinal: "24th last month"
  const ordinalRelativeRe =
    /\b(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)\s+(?:last|next|this)\s+month\b/gi;
  return firstRegexMatch(text, ordinalRelativeRe);
}

function detectFullNames(text: string): string | null {
  // First + Last name (2 tokens), each token looks like TitleCase (not acronyms).
  // Keep narrow to avoid flagging anonymous clinical text.
  const re =
    /\b[\p{Lu}][\p{Ll}]+(?:-[\p{Lu}][\p{Ll}]+)?\s+[\p{Lu}][\p{Ll}]+(?:-[\p{Lu}][\p{Ll}]+)?\b/gu;
  return firstRegexMatch(text, re);
}

function detectInitialLastName(text: string): string | null {
  // Initial + last name, e.g. "A. Andersson"
  const re = /\b[\p{Lu}]\.\s*[\p{Lu}][\p{Ll}]+(?:-[\p{Lu}][\p{Ll}]+)?\b/gu;
  return firstRegexMatch(text, re);
}

function detectNameLabels(text: string): string | null {
  // Catch common "Name/Patient:" field patterns, including single given names.
  // Keeps scope narrow to avoid flagging ordinary clinical prose like "chest pain".
  //
  // Examples:
  // - "Name: John"
  // - "Patient: John Smith"
  // - "Namn: Anna"
  // - "Patienten: Karl Andersson"
  // - "Pt: A Andersson" (handled by initial+last too, but we include here)
  const labelPrefixRe = /\b(?:name|patient(?:en)?|pt|namn)\b\s*[:\-]\s*/gi;
  // Allow lowercase ("sam") as well, since users may paste without capitalization.
  // Still requires alphabetic tokens (no digits), and rejects ALL-CAPS acronyms via later checks.
  const nameRe = /^([\p{L}]{2,})(?:\s+([\p{L}]{2,}))?\b/u;

  const notAName = new Set(
    [
      // EN
      "patient",
      "pt",
      "name",
      // SV
      "patienten",
      "patient",
      "namn"
    ].map((s) => s.toLowerCase())
  );

  for (const m of text.matchAll(labelPrefixRe)) {
    const idx = (m.index ?? 0) + (m[0]?.length ?? 0);
    const rest = text.slice(idx).trimStart();
    const nm = rest.match(nameRe);
    if (!nm) continue;
    const w1 = (nm[1] ?? "").trim();
    const w2 = (nm[2] ?? "").trim();
    if (!w1) continue;
    if (/\d/.test(w1) || (w2 && /\d/.test(w2))) continue;
    if (/^[A-ZÅÄÖ]+$/.test(w1) || (w2 && /^[A-ZÅÄÖ]+$/.test(w2))) continue; // reject ALL-CAPS acronyms
    if (notAName.has(w1.toLowerCase()) || (w2 && notAName.has(w2.toLowerCase()))) continue;
    return w2 ? `${w1} ${w2}` : w1;
  }

  return null;
}

function detectNameTagLines(text: string): string | null {
  // Speaker / name tag at start of a line.
  //
  // Examples:
  // - "John: ...", "Anna Andersson: ..."
  // - "Karl-Anders: ..."
  // Allow lowercase ("sam: ...") but reject acronyms like "NEWS:" via checks below.
  const re = /^\s*([\p{L}]{2,}(?:-[\p{L}]{2,})?(?:\s+[\p{L}]{2,}(?:-[\p{L}]{2,})?)?)\s*:\s+\S/u;

  const notAName = new Set(
    [
      // EN
      "patient",
      "pt",
      "name",
      "news",
      "bp",
      "hr",
      "rr",
      "temp",
      "spo2",
      "sat",
      "ecg",
      "ekg",
      // SV
      "patienten",
      "patient",
      "namn"
    ].map((s) => s.toLowerCase())
  );

  // Line-by-line to ensure "NEWS:" (all caps) doesn't get treated as a name.
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = line.match(re);
    if (!m) continue;
    const candidate = (m[1] ?? "").trim();
    if (!candidate) continue;
    if (/\d/.test(candidate)) continue;
    if (/^[A-ZÅÄÖ\s-]+$/.test(candidate)) continue; // reject ALL-CAPS tags like "NEWS"
    if (notAName.has(candidate.toLowerCase())) continue;
    return candidate;
  }
  return null;
}

function detectNameInProse(text: string): string | null {
  // Narrow detection for "Name reports/complains..." style prose when the user replaces "the patient" with a name.
  // We only flag if a proper-name-looking token is immediately followed by a high-signal clinical verb.
  //
  // Examples:
  // - "John reports chest pain."
  // - "Anna denies fever."
  // - "Karl söker pga bröstsmärta."
  // Allow lowercase names as well ("sam reports ...") but avoid acronyms (all caps) and anything with digits.
  const nameTokenRe = /^[\p{L}]{2,}(?:-[\p{L}]{2,})?$/u;
  const notAName = new Set(
    [
      // EN
      "patient",
      "pt",
      "name",
      "news",
      "bp",
      "hr",
      "rr",
      "temp",
      "spo2",
      "sat",
      "ecg",
      "ekg",
      // SV
      "patienten",
      "patient",
      "namn"
    ].map((s) => s.toLowerCase())
  );
  const verbs = new Set(
    [
      // EN
      "reports",
      "complains",
      "states",
      "denies",
      "presents",
      "presented",
      "arrived",
      "comes",
      "says",
      "feels",
      "notes",
      "admits",
      "seeks",
      "seeking",
      // SV
      "uppger",
      "nekar",
      "beskriver",
      "söker",
      "kommer",
      "anger",
      "mår"
    ].map((v) => v.toLowerCase())
  );

  // Split into sentence-ish chunks; we only look at the very start to stay conservative.
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/[.!?\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const parts = chunk.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;

    const t1 = parts[0] ?? "";
    const t2 = parts[1] ?? "";
    const t3 = parts[2] ?? "";

    // One-token name: "John reports ..."
    if (
      nameTokenRe.test(t1) &&
      !/\d/.test(t1) &&
      !/^[A-ZÅÄÖ]+$/.test(t1) &&
      !notAName.has(t1.toLowerCase()) &&
      verbs.has(t2.toLowerCase())
    )
      return t1;

    // Two-token name: "Anna Andersson reports ..."
    if (
      parts.length >= 3 &&
      nameTokenRe.test(t1) &&
      !notAName.has(t1.toLowerCase()) &&
      nameTokenRe.test(t2) &&
      !notAName.has(t2.toLowerCase()) &&
      verbs.has(t3.toLowerCase())
    ) {
      if (/\d/.test(t1) || /\d/.test(t2)) continue;
      if (/^[A-ZÅÄÖ]+$/.test(t1) || /^[A-ZÅÄÖ]+$/.test(t2)) continue;
      return `${t1} ${t2}`;
    }
  }

  return null;
}

function detectEmail(text: string): string | null {
  const re = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  return firstRegexMatch(text, re);
}

function detectPhoneNumber(text: string): string | null {
  // Require >= 7 digits total, allow separators.
  // Avoid matching short vitals like "P 80" by requiring many digits.
  // Important: explicitly do NOT treat Swedish personal numbers as phone numbers.
  const candidateRe = /\b(?:\+?46|0)?(?:[\s-]?\d){7,}\b/g;
  const personnummerLikeRe =
    /^\s*(?:\d{2}|\d{4})(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[-+]\d{4}\s*$/;

  for (const m of text.matchAll(candidateRe)) {
    const raw = m[0] ?? "";
    if (!raw) continue;
    if (personnummerLikeRe.test(raw)) continue;
    return raw;
  }
  return null;
}

function detectPatientIdOrJournalNumber(text: string): string | null {
  // Patient ID / journal number cues.
  // Examples: "Patient-ID: 12345", "Journalnr 987654", "MRN #A1234"
  const re =
    /\b(?:patient(?:\s*[-]?\s*)?(?:id|nr|no)|journal(?:nummer|nr)?|journ(?:\s*[-]?\s*)?(?:id|nr)|mrn|pid)\b\s*[:#]?\s*[A-Z0-9][A-Z0-9-]{2,}\b/gi;
  return firstRegexMatch(text, re);
}

function detectAddress(text: string): string | null {
  // Narrow, address-like patterns: street-type word + number, or "Box 123".
  // Examples: "Storgatan 12", "Stora Vägen 3B", "Baker Street 221B"
  const streetSuffixRe =
    /\b[\p{L}][\p{L}.-]{1,40}(?:gatan|vägen|v[aä]g|gränd|all[eé]n|gata)\s+\d{1,4}[A-Z]?\b/giu;
  const streetWordRe =
    /\b[\p{L}][\p{L}\s.-]{1,40}\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?)\s+\d{1,4}[A-Z]?\b/giu;
  const boxRe = /\b(?:box|p\.?\s*o\.?\s*box)\s+\d{1,6}\b/gi;
  return (
    firstRegexMatch(text, streetSuffixRe) ||
    firstRegexMatch(text, streetWordRe) ||
    firstRegexMatch(text, boxRe)
  );
}

function detectWardBedTimestampCombo(text: string): string | null {
  // Exact ward + bed + timestamp combo (allowed times in general, but this combo is a direct locator).
  // Examples: "Avd 12, säng 3 kl 14:30", "Ward 5 bed 2 07:15"
  const re =
    /\b(?:avd(?:elning)?|ward|unit)\s*#?\s*\d{1,3}[\s,;:-]{0,20}(?:s[aä]ng|bed|plats)\s*#?\s*\d{1,3}[\s,;:-]{0,40}(?:kl\.?|at)?\s*(?:[01]\d|2[0-3]):[0-5]\d\b/gi;
  return firstRegexMatch(text, re);
}

function detectPreciseAge(text: string): string | null {
  // Blocks *precise* ages like:
  // - "age 47", "aged 47"
  // - "47 years old", "47-year-old"
  // - "47 y/o", "47yo"
  // - "47-årig", "47 år", "47 år gammal"
  // - "47M", "32F" (common shorthand for age+sex)
  //
  // Acceptable (NOT blocked) examples include:
  // - "in their 40s", "40s"
  // - age ranges like "20-30", "20–30", "20 to 30"
  // - descriptors like "young", "old", "middle-aged"

  // Decade expressions we explicitly allow (avoid false positives when scanning).
  const decadeRe = /\b(?:\d{2})\s*'?s\b/gi; // 40s, 40's
  const decadeSvRe = /\b(?:\d{2})\s*[-–]?\s*årsåldern\b/gi; // 40-årsåldern / 40 årsåldern
  const rangeRe = /\b(?:\d{1,2})\s*(?:-|–|to)\s*(?:\d{1,2})\b/gi; // 20-30, 20–30, 20 to 30
  // Range that includes explicit "years old"/"år" wording (so we don't accidentally flag the trailing bound).
  const rangeWithAgeUnitEnRe =
    /\b(?:\d{1,2})\s*(?:-|–|to)\s*(?:\d{1,2})\s*(?:y\/o|yo|yrs?\s*old\b|years?\s*old\b|year[-\s]?old\b)\b/gi;
  const rangeWithAgeUnitSvRe =
    /\b(?:\d{1,2})\s*(?:-|–|to)\s*(?:\d{1,2})\s*(?:årig\b|år\b(?:\s*gammal\b)?)\b/gi;

  // Collect allowed spans so we can ignore matches fully contained within them.
  const allowedSpans: Array<{ start: number; end: number }> = [];
  const addAllowed = (re: RegExp) => {
    for (const m of text.matchAll(re)) {
      if (m.index == null) continue;
      const hit = m[0] ?? "";
      if (!hit) continue;
      allowedSpans.push({ start: m.index, end: m.index + hit.length });
    }
  };
  addAllowed(decadeRe);
  addAllowed(decadeSvRe);
  addAllowed(rangeRe);
  addAllowed(rangeWithAgeUnitEnRe);
  addAllowed(rangeWithAgeUnitSvRe);

  const isWithinAllowed = (start: number, end: number) =>
    allowedSpans.some((s) => start >= s.start && end <= s.end);

  // "47 years old", "47-year-old", "47 y/o", "47yo"
  const enPreciseRe =
    /\b(?:[1-9]\d)\s*(?:y\/o|yo|yrs?\s*old\b|years?\s*old\b|year[-\s]?old\b)\b/gi;
  // "age 47", "aged 47", "age: 47"
  // Allow: "age 20-30" / "age 20–30" / "age 20 to 30"
  const enAgeLabelRe =
    /\b(?:age|aged)\s*[:\-]?\s*(?:[1-9]\d)(?:\s*(?:-|–|to)\s*(?:[1-9]\d))?\b/gi;

  // Swedish: "47 år", "47-årig", "47 år gammal", "47-årig man"
  const svPreciseRe =
    /\b(?:[1-9]\d)\s*(?:[-–]\s*)?(?:årig\b|år\b(?:\s*gammal\b)?)\b/gi;
  // Swedish label: "ålder 47", "ålder: 47"
  // Allow: "ålder 20-30" / "ålder 20–30"
  const svAgeLabelRe =
    /\b(?:ålder)\s*[:\-]?\s*(?:[1-9]\d)(?:\s*(?:-|–|to)\s*(?:[1-9]\d))?\b/gi;

  // Shorthand: "47M", "32F" (often used as "47M presents with...")
  const ageSexRe = /\b(?:[1-9]\d)\s*(?:[MF])\b/g;

  const candidates = [
    { re: enPreciseRe, canBeRange: false },
    { re: enAgeLabelRe, canBeRange: true },
    { re: svPreciseRe, canBeRange: false },
    { re: svAgeLabelRe, canBeRange: true },
    { re: ageSexRe, canBeRange: false }
  ];

  for (const { re, canBeRange } of candidates) {
    for (const m of text.matchAll(re)) {
      if (m.index == null) continue;
      const hit = m[0] ?? "";
      if (!hit) continue;
      const start = m.index;
      const end = start + hit.length;
      if (isWithinAllowed(start, end)) continue;
      // If the matched label contains an explicit range, it's acceptable.
      if (canBeRange && /(?:-|–|to)/i.test(hit)) continue;
      return hit;
    }
  }
  return null;
}

export function detectIdentifiers(text: string): IdentifierDetectionResult {
  const reasons: IdentifierReason[] = [];
  const matches: IdentifierMatch[] = [];

  const push = (reason: IdentifierReason, match: string | null) => {
    if (!match) return;
    reasons.push(reason);
    matches.push({ reason, match });
  };

  push("swedish_personal_number", detectSwedishPersonalNumber(text));
  push("date", detectDate(text));
  push("temporal_reference", detectTemporalReference(text));
  push("precise_age", detectPreciseAge(text));
  push("full_name", detectFullNames(text));
  push("initial_last_name", detectInitialLastName(text));
  push("name_label", detectNameLabels(text));
  push("name_tag", detectNameTagLines(text));
  push("name_in_prose", detectNameInProse(text));
  push("patient_id_or_journal_number", detectPatientIdOrJournalNumber(text));
  push("email", detectEmail(text));
  push("phone_number", detectPhoneNumber(text));
  push("address", detectAddress(text));
  push("ward_bed_timestamp", detectWardBedTimestampCombo(text));

  const unique = uniq(reasons);
  const uniqueMatches: IdentifierMatch[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const key = `${m.reason}::${m.match}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueMatches.push(m);
  }
  return { hasIdentifiers: unique.length > 0, reasons: unique, matches: uniqueMatches };
}


