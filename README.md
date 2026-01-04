# ClinicalNoteTool

ClinicalNoteTool is a minimal Next.js web app that **restructures anonymised clinical free-text** into a **structured clinical note** (SOAP-style).

It is designed as a **stateless formatter**: you paste text, get a draft note, and nothing is stored.

## What it does
- **Input**: anonymised clinical text (Swedish or English UI)
- **Output**: a structured note using fixed section headers (language-dependent)
- **API**: `POST /api/soap` returns `{ "soap": "..." }`

## What it does NOT do (by design)
- No patient record / journal system functionality
- No authentication
- No database, no storage, no history
- No analytics
- No logging of user input

## Safety & privacy guardrails (hard requirements)
- **Do NOT include patient identifiers** in the input.
- The backend **hard-blocks** processing if identifiers are detected:
  - dates (common formats)
  - full names (strict heuristic)
  - Swedish personal numbers `YYYYMMDD-XXXX`
- When blocked: the request returns **400** and **no OpenAI call is made**.

**Disclaimer**: Not a hospital system. Not a medical device.

## Quickstart
1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` (Next.js reads it automatically):

```bash
OPENAI_API_KEY=your_key_here
NEXT_TELEMETRY_DISABLED=1
```

3. Run the dev server:

```bash
npm run dev
```

## API
### `POST /api/soap`
**Request body**:
- `text` (string, required)
- `language` (`"sv"` | `"en"`, optional; defaults to `"sv"`)

**Response**:
- `200`: `{ "soap": "..." }`
- `400`: `{ "error": "...", "reasons": ["date" | "full_name" | "swedish_personal_number"] }`

## Implementation notes (high level)
- **UI**: `app/page.tsx`
- **API route**: `app/api/soap/route.ts`
- **Identifier detection**: `lib/pii.ts`
- **OpenAI client**: `lib/openai.ts`
