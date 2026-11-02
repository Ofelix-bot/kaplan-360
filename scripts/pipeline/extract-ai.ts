// Step 4: fill the fields the rules could not read, with Claude (Haiku), from the same cached
// official pages. Claude sees only the page lines relevant to the missing fields and must return,
// for each value, the exact quote it was read from. Every quote is checked against the page text:
// a value whose quote is not on the page, or does not contain the value, is dropped.
// Usage: npx tsx scripts/pipeline/extract-ai.ts [--only=aston-university] [--limit=50] [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { AI_FILE, AI_MODEL, EXTRACTED_FILE, FETCH_LOG_FILE, INSTITUTIONS_FILE } from "./config";
import { pageText, type PageText } from "./extract-lib";
import type { ExtractedRecord } from "./extract";
import type { FetchEntry } from "./fetch";
import { args, pool, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));


export type AiField = { value: string | number; quote: string; url: string; verified: boolean };
export type AiResult = {
  base: string;
  source: string;
  model: string;
  extractedAt: string;
  fields: Partial<Record<FieldName, AiField>>;
  dropped: { field: FieldName; reason: string }[];
  usage: { input: number; output: number };
};

const FIELDS = ["tuitionInternational", "ieltsOverall", "toeflTotal", "durationMonths", "intakes", "academicRequirement", "studyMode", "teachingLanguage"] as const;
type FieldName = (typeof FIELDS)[number];

const RELEVANT = /(fee|tuition|£|€|\$|aud|gbp|eur|cost|international|overseas|per year|per annum|total|ielts|toefl|english|language|duration|months?|years?|full[- ]time|start|intake|commenc|january|february|september|entry|requirement|degree|honours|2:1|2:2|gpa|equivalent|bachelor|undergraduate|qualification|admission|eligib)/i;

/** Lines that carry a value: an amount, an English score, a length or a degree class. */
const MONEY_LINE = /(£|€|\$|\b(aud|gbp|eur|sgd|usd)\b)\s?\d{1,3}(,?\d{3})+|\d{1,3}(,\d{3})+\s?(£|€)/i;
const ENGLISH_LINE = /\bielts\b|\btoefl\b|\bpte\b/i;
const VALUE_LINE =/(£|€|\$|\b(aud|gbp|eur|sgd|usd)\b)\s?\d|\d[\d,]{3,}\s?(£|€)|\bielts\b|\btoefl\b|\b\d{1,2}(\.\d)?\s*(months?|years?)\b|\b2[:.][12]\b|\bgpa\b|\bwam\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

/**
 * The lines that can hold the missing fields, in page order and capped in length. Value lines and
 * the 3 lines around them come first (fee tables put labels on neighbouring lines); other relevant
 * lines fill the rest, so navigation text can't push the fee table out.
 */
function context(pages: PageText[], maxChars = 14000): string {
  const picked = pages.map(() => new Set<number>());
  let size = 0;
  const take = (pi: number, i: number) => {
    const s = picked[pi];
    if (s.has(i)) return true;
    const len = pages[pi].lines[i].length + 1;
    if (size + len > maxChars) return false;
    s.add(i);
    size += len;
    return true;
  };
  // Fee figures first, then English scores, then other values: on long pages (module lists full of
  // dates) the budget would otherwise run out before the fee table is reached.
  for (const pass of [MONEY_LINE, ENGLISH_LINE, VALUE_LINE, RELEVANT]) {
    const radius = pass === RELEVANT ? 1 : 3;
    pages.forEach((p, pi) =>
      p.lines.forEach((l, i) => {
        if (!pass.test(l) || l.length > 600) return;
        for (let j = Math.max(0, i - radius); j <= Math.min(p.lines.length - 1, i + radius); j++) take(pi, j);
      }),
    );
  }
  return pages
    .map((p, pi) => [`[page: ${p.url}]`, ...[...picked[pi]].sort((a, b) => a - b).map((i) => p.lines[i])].join("\n"))
    .join("\n");
}

const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

const digitsOf = (s: string) => s.replace(/[^\d]/g, "");
const FEE_LABEL = /international|overseas|\bhome\b|\buk\b|domestic|\beu\b|australian|irish|full[- ]time|part[- ]time|annual|per year|full course|first year/i;
const INTERNATIONAL = /international|overseas|non[- ]?eu\b|non[- ]?eea|non-uk|non[- ]local/i;
const NOT_INTERNATIONAL = /\bhome\b|\buk students?\b|^uk\b|domestic|australian (students?|citizens?)|\birish\b|\beu students?\b|part[- ]time/i;

/**
 * Finds the page lines that hold a fee figure and checks that the nearest fee label above it (within
 * 12 lines, or on the same line) names international or overseas students. Returns the page's own
 * label and figure lines, so the stored quote is the page's text rather than the model's.
 */
/** What a fee covers, from the page's own wording around it (null when the page doesn't say). */
function feeBasis(lines: string[]): string | null {
  // "may be subject to annual increase" is about future rises, not what the fee covers.
  const t = lines.join(" ").toLowerCase().replace(/(subject to |an? )?annual(ly)? (increase|inflation|review)s?|increase[ds]? annually|reviewed annually/g, " ");
  if (/full course fee|total (course|programme|tuition) fee|for the (whole|entire) course|full programme fee/.test(t)) return "full course";
  if (/first year/.test(t)) return "first year";
  if (/annual|per year|per annum|a year|each year/.test(t)) return "per year";
  return null;
}

export function locateInternationalFee(
  amount: number,
  lines: string[],
  /** Hong Kong and Macau: a taught master's usually has one fee for every student, labelled only "Tuition fee". */
  oneFeeForAll = false,
): { label: string; figure: string; basis: string | null } | null {
  const want = String(Math.round(amount));
  // A fee for local students only ("Local students: HK$…", "Macao residents"); "non-local" is the international fee.
  const LOCAL_ONLY = /(?<!non[- ])\blocal (students?|applicants?)\b|(hong kong|macao?|macau) (students|residents|permanent residents)/i;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!/[£€$]|\b(aud|gbp|eur|sgd|usd|hkd|mop|rmb)\b/i.test(l) || !digitsOf(l).includes(want)) continue;
    // The basis is read only between the label and the figure: neighbouring rows belong to other fees.
    if (INTERNATIONAL.test(l) && !NOT_INTERNATIONAL.test(l.replace(INTERNATIONAL, ""))) return { label: l, figure: l, basis: feeBasis([l]) };
    for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
      if (oneFeeForAll && /tuition|programme fee|program fee|course fee|composition fee/i.test(lines[j])) {
        if (LOCAL_ONLY.test(lines[j]) || LOCAL_ONLY.test(l)) break;
        if (!lines.some((x) => LOCAL_ONLY.test(x) && /[$]|\b(hkd|mop)\b/i.test(x))) return { label: lines[j], figure: l, basis: feeBasis(lines.slice(j, i + 1)) };
      }
      if (!FEE_LABEL.test(lines[j])) continue;
      if (INTERNATIONAL.test(lines[j]) && !/\bhome\b|domestic/i.test(lines[j]))
        return { label: lines[j], figure: l, basis: feeBasis(lines.slice(j, i + 1)) };
      if (NOT_INTERNATIONAL.test(lines[j])) break; // the nearest label is for another student group
    }
    // The fee on the same line as its label ("Tuition Fee: HK$280,000").
    if (oneFeeForAll && /tuition|programme fee|program fee|course fee|composition fee/i.test(l) && !LOCAL_ONLY.test(l)) return { label: l, figure: l, basis: feeBasis([l]) };
  }
  return null;
}

/** Non-fee fields: the quote must be on the page and contain the value it supports. */
function verify(field: FieldName, value: string | number, quote: string, pageBlob: string): string | null {
  if (!quote || !squash(pageBlob).includes(squash(quote))) return "quote not found verbatim on the page";
  const q = squash(quote);
  if (field === "ieltsOverall" && !q.includes(String(value))) return "IELTS score not in its quote";
  if (field === "toeflTotal" && (!q.includes(String(value)) || !/toefl/i.test(q))) return "TOEFL score not in its quote";
  if (field === "durationMonths" && !/\d|one|two|three|twelve|eighteen/.test(q)) return "duration not in its quote";
  if (field === "studyMode" && !/full[- ]?time|part[- ]?time|全日制|兼讀|兼读/.test(q)) return "study mode not in its quote";
  if (field === "teachingLanguage") {
    const word = String(value).toLowerCase().split(/[\s,]+/)[0];
    if (!q.includes(word) && !/medium of instruction|language of instruction|taught in|授課語言|教學語言|授课语言|教学语言/.test(q)) return "language not in its quote";
  }
  return null;
}

/** Duration in a label/value layout ("Full time duration" … "2"): both lines on the page, the value within 6 lines. */
function verifyPair(quote: string, valueQuote: string, lines: string[]): string | null {
  const L = lines.map(squash);
  const q = squash(quote);
  const v = squash(valueQuote);
  if (!/\d/.test(v)) return "value line has no number";
  const labels = L.map((l, i) => (l.includes(q) ? i : -1)).filter((i) => i >= 0);
  if (!labels.length) return "label not found verbatim on the page";
  if (!labels.some((i) => L.slice(i + 1, i + 7).some((l) => l === v))) return "value not near its label";
  return null;
}

const TOOL: Anthropic.Tool = {
  name: "record_programme_fields",
  description: "Record programme facts read from the official page text. Use null when the text does not state a fact.",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(
      FIELDS.map((f) => [
        f,
        {
          type: ["object", "null"],
          properties: {
            value: { type: ["string", "number"] },
            basis: { type: "string", description: "tuition only: e.g. 'per year, 2026/27 entry' or 'full course'" },
            currency: { type: "string", description: "tuition only: ISO code, e.g. GBP, AUD, EUR" },
            quote: { type: "string", description: "the exact words from the page text the value was read from, copied character for character" },
            valueQuote: { type: "string", description: "tuition or duration, when the value is on a different line from its label: that line, copied exactly (e.g. \"$81,600\" or \"2\")" },
          },
          required: ["value", "quote"],
        },
      ]),
    ),
    required: [...FIELDS],
  },
};

const INSTRUCTIONS = `You read official university programme pages for a study-planning prototype for Singapore students.
From the page text, record only what it states:
- tuitionInternational: the tuition fee for international (overseas) students for the full-time programme, as a number. Prefer the most recent intake. If only a per-year fee is given, use it and say so in basis. Never use the home/UK/domestic fee. In Hong Kong and Macau, where one tuition fee applies to all students, use it; where local and non-local fees differ, use the non-local fee.
- ieltsOverall: the minimum overall IELTS (Academic) score, as a number.
- toeflTotal: the minimum TOEFL iBT total score (0–120), as a number; null for paper-based scores only.
- durationMonths: the standard full-time length in months, as a number (1 year = 12). In Mode / Duration tables choose the plain full-time row, not "with placement" or "professional placement" variants. When the page shows a bare number under a "duration" label (e.g. "Full time duration" then "2"), it is in years: put the label line in quote and the number line in valueQuote.
- intakes: the start months, e.g. "September, January".
- academicRequirement: the minimum academic entry requirement sentence for applicants with a bachelor's degree, for the standard full-length programme. It must name the qualification (degree, grade, GPA or credits). Not a lead-in ("applicants must prove the following:"), not an English language rule, not a route for a shortened or accelerated version, not a route only for holders of the country's own degrees when the page gives one for international applicants, and not a description of the course.
- studyMode: "full-time", "part-time" or "both": the study modes the page offers for this programme.
- teachingLanguage: the medium of instruction as the page states it, e.g. "English", "Chinese", "Putonghua", "Chinese and English", "Portuguese".
Every quote must be copied exactly from the page text, short (one line or sentence) and must contain the value.
Fee tables: when the label (e.g. "Full course fee (international)") and the figure (e.g. "$81,600") are on different lines, put the label line in quote and the figure line in valueQuote. Prefer the full-course international fee for the latest year shown; otherwise the first-year or annual international fee, and say which in basis.
Use null when the text does not state the fact; do not guess or use outside knowledge.`;

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });

  const extracted = readJson<ExtractedRecord[]>(EXTRACTED_FILE, []);
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const roster = readJson<{ institutions: { id: string; country: string | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const countryOf = new Map(roster.institutions.map((r) => [r.id, r.country]));
  const prev = readJson<Record<string, AiResult>>(AI_FILE, {});

  const todo = extracted
    .filter((r) => r.result?.discipline && r.result.degreeType && r.pages.length)
    .filter((r) => !a.only || a.only.includes(r.source))
    .filter((r) => a.refresh || !prev[r.base])
    .slice(0, a.limit ?? Infinity);
  console.log(`Claude fills missing fields for ${todo.length} programmes (${AI_MODEL})…`);

  type Answer = Record<string, { value: string | number; quote: string; valueQuote?: string; basis?: string; currency?: string } | null>;
  let input = 0, output = 0;
  const ask = async (content: string) => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: INSTRUCTIONS,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content }],
    });
    input += msg.usage.input_tokens;
    output += msg.usage.output_tokens;
    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    return { data: (call?.input ?? {}) as Answer, usage: msg.usage };
  };

  let done = 0;
  let failed = 0;
  await pool(todo, 4, async (r) => {
    try {
      await fill(r);
    } catch (e) {
      // An API error on one programme is logged and retried on the next run (nothing is saved for it).
      failed++;
      console.log(`${r.source.slice(0, 12).padEnd(12)} ${String(r.result?.name).slice(0, 48).padEnd(48)} error: ${(e as Error).message.slice(0, 200)}`);
    }
    // Saved every 25 programmes, so an interrupted run keeps its work.
    if (++done % 25 === 0) writeJson(AI_FILE, prev);
  });
  writeJson(AI_FILE, prev);
  if (failed) console.log(`${failed} programmes failed; run again to retry them`);
  console.log(`Tokens: input ${input}, output ${output} · cost ≈ US${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)} (Haiku 5.5: $0.10 / $0.50 per MTok)`);

  async function fill(r: ExtractedRecord) {
    const pages = r.pages.map((url) => pageText({ url, html: readFileSync(log[url].file!, "utf8") }));
    const blob = pages.map((p) => p.lines.join("\n")).join("\n");
    const res = r.result!;
    const missing = FIELDS.filter((f) =>
      f === "tuitionInternational" ? true : // always asked: the rules can't tell international from home fees
      f === "ieltsOverall" ? !res.englishScores?.ielts :
      f === "toeflTotal" ? !res.tests?.toefl && !res.englishScores?.toefl :
      f === "durationMonths" ? !res.duration :
      f === "intakes" ? !res.intake :
      f === "studyMode" || f === "teachingLanguage" ? true : // asked on every page: the rules don't read them
      !res.academic,
    );
    const head = `Programme: ${res.name}\nCountry: ${countryOf.get(r.source) ?? "unknown"}`;
    const ctx = context(pages);
    const first = await ask(`${head}\nFields needed: ${missing.join(", ")} (use null for the others)\n\nPage text:\n${ctx}`);
    const usage = { input: first.usage.input_tokens, output: first.usage.output_tokens };
    const fields: AiResult["fields"] = {};
    const dropped: AiResult["dropped"] = [];

    const takeFee = (v: Answer[string]): string | null => {
      if (!v || v.value === null || v.value === "") return "not stated";
      const amount = Number(String(v.value).replace(/[^\d.]/g, ""));
      const oneFee = /Hong Kong|Macau/.test(countryOf.get(r.source) ?? "");
      const at = pages.map((p) => ({ p, hit: locateInternationalFee(amount, p.lines, oneFee) })).find((x) => x.hit);
      if (!at) return `no line with ${v.value} under an international fee label`;
      const { label, figure, basis } = at.hit!;
      fields.tuitionInternational = {
        // The basis comes from the page's own wording, not the model's description.
        value: JSON.stringify({ amount, currency: v.currency ?? null, basis }),
        quote: label === figure ? figure : `${label} … ${figure}`,
        url: at.p.url,
        verified: true,
      };
      return null;
    };

    let feeWhy = takeFee(first.data.tuitionInternational);
    if (feeWhy && feeWhy !== "not stated") {
      // One retry for the fee, telling the model why its answer was rejected.
      const retry = await ask(`${head}\nFields needed: tuitionInternational only (use null for the others).\nA previous answer was rejected: ${feeWhy}. Give the international (overseas) fee exactly as it appears next to its label.\n\nPage text:\n${ctx}`);
      usage.input += retry.usage.input_tokens;
      usage.output += retry.usage.output_tokens;
      feeWhy = takeFee(retry.data.tuitionInternational);
    }
    if (feeWhy && feeWhy !== "not stated") dropped.push({ field: "tuitionInternational", reason: feeWhy });

    for (const f of missing.filter((x) => x !== "tuitionInternational")) {
      const v = first.data[f];
      if (!v || v.value === null || v.value === "") continue;
      // Form controls ("I want to start studying in Trimester 1") are not statements about the programme.
      if (f === "intakes" && /\bI want to\b|\bselect\b|\bchoose\b|\bplease pick\b/i.test(v.quote)) {
        dropped.push({ field: f, reason: "quote is form text, not an intake statement" });
        continue;
      }
      const why =
        f === "durationMonths" && v.valueQuote && !squash(v.quote).includes(squash(v.valueQuote))
          ? verifyPair(v.quote, v.valueQuote, pages.flatMap((p) => p.lines))
          : verify(f, v.value, v.quote, blob);
      if (why) { dropped.push({ field: f, reason: why }); continue; }
      const url = pages.find((p) => squash(p.lines.join(" ")).includes(squash(v.quote)))?.url ?? r.base;
      const quote = v.valueQuote && !squash(v.quote).includes(squash(v.valueQuote)) ? `${v.quote} … ${v.valueQuote}` : v.quote;
      fields[f] = { value: v.value, quote, url, verified: true };
    }
    prev[r.base] = { base: r.base, source: r.source, model: AI_MODEL, extractedAt: today(), fields, dropped, usage };
    console.log(`${r.source.slice(0, 12).padEnd(12)} ${String(res.name).slice(0, 48).padEnd(48)} +${Object.keys(fields).length} kept, ${dropped.length} dropped`);
  }
}

// Run only when executed directly: build.ts imports this file for its types.
if (process.argv[1]?.endsWith("extract-ai.ts")) main();
