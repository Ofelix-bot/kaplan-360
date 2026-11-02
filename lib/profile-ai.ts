import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import fx from "@/data/raw/fx-mas.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import { getProgrammeCountries } from "@/lib/data/partners";
import { SCHOOLS } from "@/lib/data/topups";
import type { ProfileReading } from "@/lib/profile-reading";
import { COUNTRY_CODES } from "@/lib/countries";
import { DIRECTIONS, MAX_DIRECTIONS } from "@/lib/finder/directions";

// "Fill in the form for me" (the homepage, and Describe yourself on Programmes for you): the one sentence a student typed, read by
// Claude (Haiku) into the planner's own fields. Only that sentence is sent; it is not stored or
// logged. Every value is checked against the field's allowed values before it goes back to the
// browser, where the student confirms it before anything is saved. Screenshots and PDFs they attach
// (Kaplan360, school emails) are read the same way by readProfileFromFiles, and are not kept either.

const MODEL = "claude-haiku-5-5";
/** Screenshots and PDFs (readProfileFromFiles). */
const FILES_MODEL = "claude-sonnet-5-5";

const RATES = fx.rates as Record<string, number>;
const PROGRAMMES = kaplan.programmes.map((p) => ({ id: p.id, name: p.name, level: /diploma/.test(p.level) ? ("diploma" as const) : ("degree" as const) }));
const DISCIPLINES = Object.keys(kaplan.disciplines);
const OTHER_SCHOOLS = SCHOOLS.filter((s) => s.id !== "kaplan");

const DIRECTION_IDS = DIRECTIONS.map((d) => d.id);

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

/** The planner's fields as tool properties; the parents' reader (lib/parent-ai.ts) adds its own to these. */
export function profileProperties(countries: string[]) {
  return {
    level: nullable({ type: "string", enum: ["diploma", "degree"] }),
    kaplanProgrammeId: nullable({ type: "string", enum: PROGRAMMES.map((p) => p.id) }),
    otherSchoolId: nullable({ type: "string", enum: OTHER_SCHOOLS.map((s) => s.id) }),
    field: nullable({ type: "string", enum: DISCIPLINES }),
    graduationMonth: nullable({ type: "integer" }),
    graduationYear: nullable({ type: "integer" }),
    status: nullable({ type: "string", enum: ["student-pass", "citizen-pr", "other-pass"] }),
    englishTest: nullable({ type: "string", enum: ["ielts", "toefl", "pte", "duolingo"] }),
    englishScore: nullable({ type: "number" }),
    averageMark: nullable({ type: "number" }),
    gpa: nullable({ type: "number" }),
    classification: nullable({ type: "string", enum: ["first", "2:1", "2:2", "third"] }),
    countries: { type: "array", items: { type: "string", enum: countries } },
    intake: nullable({ type: "string", enum: ["jan-mar", "jul-oct"] }),
    budgetAmount: nullable({ type: "number" }),
    budgetCurrency: nullable({ type: "string", enum: Object.keys(RATES) }),
  };
}

/**
 * /profile's own answers, read by this reader only (the parents' reader keeps the fields above). Not nullable: the
 * API takes at most 16 nullable fields in a strict tool, and the fields above use 15. "Not stated" is "unknown", "",
 * or 0 instead.
 */
const PROFILE_EXTRA = {
  sgStatus: { type: "string", enum: ["unknown", "citizen", "pr", "student-pass", "other-pass"] },
  nationality: { type: "string", enum: ["", ...COUNTRY_CODES] },
  graduated: { type: "string", enum: ["unknown", "yes", "no"] },
  birthYear: { type: "integer" },
  englishTestDate: { type: "string" },
  directions: { type: "array", items: { type: "string", enum: DIRECTION_IDS } },
};

function fillTool(countries: string[]): Anthropic.Tool {
  const properties = { ...profileProperties(countries), ...PROFILE_EXTRA };
  return {
    name: "fill_profile",
    description: "Record what the student's sentence states about their studies and plans. Null, or an empty list, for anything it doesn't state.",
    strict: true,
    input_schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
}

/** The lists the ids come from, shared with the parents' reader. */
export const PROFILE_LISTS = `Kaplan programmes (id: name):
${PROGRAMMES.map((p) => `${p.id}: ${p.name} (${p.level})`).join("\n")}

Other schools (id: name):
${OTHER_SCHOOLS.map((s) => `${s.id}: ${s.name}`).join("\n")}

Fields (id: name):
${Object.entries(kaplan.disciplines)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}`;

const RULES = `Rules:
- Fill a field only when the sentence states it or makes it plain. Otherwise use null (an empty list for countries). Never guess.
- Resolve relative dates ("next June", "明年 6 月") from today's date, given with the sentence.
- level: "diploma" for a diploma or advanced diploma they are studying now; "degree" for a bachelor's (including a top-up) they are studying now.
- kaplanProgrammeId: only when they study at Kaplan and the sentence points to one programme in the list below. A field alone ("a business diploma") goes in field, not here.
- otherSchoolId: when they study at one of the other schools listed below.
- field: the subject area of what they study now.
- status: a Student's Pass, or an international student at a Singapore private school, is "student-pass"; a Singapore citizen or permanent resident is "citizen-pr"; any other pass (dependant's, work pass) is "other-pass".
- englishTest and englishScore: the test named and its overall score.
- averageMark is a percentage; gpa is on the university's own scale; classification is a UK-style class (First, 2:1, 2:2, Third).
- sgStatus: the same status, with citizens ("citizen") and permanent residents ("pr") apart; "unknown" when it isn't stated or isn't clear which.
- nationality: the ISO 3166-1 alpha-2 code of their nationality or citizenship ("Indian" = IN, "中国" = CN); "SG" for a Singapore citizen; "" when not stated. Never from where they study or live alone.
- graduated: "yes" when they have already graduated, "no" when they are still studying, "unknown" when not stated; graduationMonth and graduationYear are when they graduated or will.
- birthYear: the year of birth, only when a date of birth or the year is written; 0 otherwise. Never from an age or a class year.
- englishTestDate: when the English test was taken, as "YYYY-MM"; "" when not stated.
- directions: up to three master's directions they want, from the tool's list (finance, accounting, management, marketing, esg (sustainability), computing, data, ai, media, psychology, education, ir (international relations)).
- countries: the countries they would study a master's in, as named in the tool's list ("UK", "英国" = United Kingdom; "澳洲" = Australia).
- intake: a master's start in January to March is "jan-mar"; July to October is "jul-oct".
- budgetAmount and budgetCurrency: the most they would pay in tuition a year, with its currency ("4 万新币" = 40000 SGD; "£20k" = 20000 GBP).
- Every sentence you write for the student, in English or Chinese, states the fact and its basis, with no hedging. In English never write may, might, could, can (as a possibility), likely, probably, perhaps, usually, typically or generally; in Chinese never write 可能, 或许, 也许, 大概, 应该会, 可以, 可以考虑, 一般 or 通常. Quotes from universities' and government pages stay word for word.

${PROFILE_LISTS}`;

const SYSTEM = `You read one sentence a student in Singapore wrote about themselves, in any language, and record it with the fill_profile tool for a study planner.

${RULES}`;

const FILES_SYSTEM = `You read the files a student in Singapore sent about their studies (screenshots of the Kaplan360 student app, emails from their school about their course, as images or PDFs), with the sentence they typed if any, and record them with the fill_profile tool for a study planner. Always answer with one fill_profile call.

What the files hold:
- A Kaplan360 screenshot shows the programme they are enrolled in, module results, and an average mark or GPA. Record the overall figure the screen states; never compute one from module marks.
- A school email names the programme, its start and completion or graduation dates, and the student's pass when it mentions one.
- The rules below say "the sentence"; read it as the files together with any sentence. Where the sentence and a file disagree, the sentence wins.

${RULES}`;

export type ProfileToolInput = {
  level: "diploma" | "degree" | null;
  kaplanProgrammeId: string | null;
  otherSchoolId: string | null;
  field: string | null;
  graduationMonth: number | null;
  graduationYear: number | null;
  status: "student-pass" | "citizen-pr" | "other-pass" | null;
  englishTest: "ielts" | "toefl" | "pte" | "duolingo" | null;
  englishScore: number | null;
  averageMark: number | null;
  gpa: number | null;
  classification: "first" | "2:1" | "2:2" | "third" | null;
  countries: string[];
  intake: "jan-mar" | "jul-oct" | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  // /profile's reader only (PROFILE_EXTRA); absent from the parents' reader.
  sgStatus?: "unknown" | "citizen" | "pr" | "student-pass" | "other-pass";
  nationality?: string;
  graduated?: "unknown" | "yes" | "no";
  birthYear?: number;
  /** "YYYY-MM", or "". */
  englishTestDate?: string;
  directions?: string[];
};

/** Each test's overall score range; IELTS moves in half bands. */
const SCORE: Record<string, [number, number, number]> = { ielts: [1, 9, 0.5], toefl: [0, 120, 1], pte: [10, 90, 1], duolingo: [10, 160, 5] };
const inRange = (n: number | null, lo: number, hi: number) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;

/** Only values the planner's fields can hold, consistent with each other. */
export function clean(x: ProfileToolInput, countries: Set<string>, today: Date): ProfileReading {
  const patch: ProfileReading["patch"] = {};
  const programme = PROGRAMMES.find((p) => p.id === x.kaplanProgrammeId) ?? null;
  const level = x.level ?? programme?.level ?? (x.otherSchoolId ? "diploma" : null);
  if (level) patch.level = level;
  const school = level === "diploma" && OTHER_SCHOOLS.some((s) => s.id === x.otherSchoolId) ? x.otherSchoolId : null;
  const field = x.field && DISCIPLINES.includes(x.field) ? x.field : null;
  if (school) {
    patch.school = school;
    if (field) patch.schoolDiscipline = field;
  } else if (programme && programme.level === level) patch.programmeId = programme.id;

  const year = today.getFullYear();
  const month = Number.isInteger(x.graduationMonth) && inRange(x.graduationMonth, 1, 12) ? x.graduationMonth! : null;
  const gradYear = Number.isInteger(x.graduationYear) && inRange(x.graduationYear, year, year + 6) ? x.graduationYear! : null;
  if (gradYear && (!month || gradYear * 12 + month >= year * 12 + today.getMonth() + 1)) patch.graduationYear = gradYear;
  if (month && (!gradYear || patch.graduationYear)) patch.graduationMonth = month;
  if (x.sgStatus && x.sgStatus !== "unknown") {
    patch.sgStatus = x.sgStatus;
    patch.status = x.sgStatus === "citizen" || x.sgStatus === "pr" ? "citizen-pr" : x.sgStatus;
  } else if (x.status) patch.status = x.status;
  const nationality = patch.sgStatus === "citizen" ? "SG" : x.nationality && COUNTRY_CODES.includes(x.nationality) ? x.nationality : null;
  if (nationality) patch.nationality = nationality;
  if (x.graduated === "yes" || x.graduated === "no") patch.graduated = x.graduated === "yes";
  if (x.birthYear && Number.isInteger(x.birthYear) && inRange(x.birthYear, 1950, year - 14)) patch.birthYear = x.birthYear;

  if (x.englishTest) {
    patch.englishTest = x.englishTest;
    const [lo, hi, step] = SCORE[x.englishTest];
    if (inRange(x.englishScore, lo, hi)) patch.englishScore = Math.round(x.englishScore! / step) * step;
    const taken = /^(\d{4})-(\d{2})$/.exec(x.englishTestDate ?? "");
    if (taken && inRange(Number(taken[2]), 1, 12) && inRange(Number(taken[1]), year - 4, year)) {
      patch.englishTestMonth = Number(taken[2]);
      patch.englishTestYear = Number(taken[1]);
    }
  }
  if (level === "degree") {
    if (inRange(x.averageMark, 0, 100)) patch.averageMark = Math.round(x.averageMark!);
    if (inRange(x.gpa, 0, 4.5)) patch.degreeGpa = Math.round(x.gpa! * 100) / 100;
    if (x.classification) patch.classification = x.classification;
  }
  const named = [...new Set(x.countries.filter((c) => countries.has(c)))];
  if (named.length) patch.countries = named;
  if (x.intake) patch.intake = x.intake;

  let budgetFrom: ProfileReading["budgetFrom"] = null;
  if (x.budgetAmount && x.budgetCurrency && RATES[x.budgetCurrency] && x.budgetAmount > 0) {
    const sgd = Math.round((x.budgetAmount * RATES[x.budgetCurrency]) / 1000) * 1000;
    if (inRange(sgd, 5000, 250000)) {
      patch.budget = sgd;
      if (x.budgetCurrency !== "SGD") budgetFrom = { amount: x.budgetAmount, currency: x.budgetCurrency };
    }
  }
  const directions = [...new Set((x.directions ?? []).filter((d) => DIRECTION_IDS.includes(d)))].slice(0, MAX_DIRECTIONS);
  return { patch, budgetFrom, field: school ? null : field, ...(directions.length ? { directions } : {}) };
}

/** The planner's fields read from one sentence. Throws the SDK's errors for the route to answer. */
export async function readProfile(sentence: string, apiKey: string): Promise<ProfileReading> {
  const countries = (await getProgrammeCountries()).map((c) => c.country);
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey, timeout: 9000, maxRetries: 1, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const today = new Date();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [fillTool(countries)],
    tool_choice: { type: "tool", name: "fill_profile" },
    messages: [{ role: "user", content: `Today is ${today.toISOString().slice(0, 10)}.\n\nThe student's sentence:\n${sentence}` }],
  });
  const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!call) return { patch: {}, budgetFrom: null, field: null };
  return clean(call.input as ProfileToolInput, new Set(countries), today);
}

/** A file the student sent, already checked by the route: an image or a PDF, base64. */
export type ProfileFile = { mediaType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; data: string };

/**
 * The planner's fields read from screenshots and PDFs (Kaplan360, school emails), with the sentence if
 * one was typed. Sonnet reads small print and tables better than Haiku; it takes no forced tool choice,
 * so the tool is strict and the prompt asks for the one call. Throws the SDK's errors for the route.
 */
export async function readProfileFromFiles(files: ProfileFile[], sentence: string, apiKey: string): Promise<ProfileReading> {
  const countries = (await getProgrammeCountries()).map((c) => c.country);
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 0, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const today = new Date();
  const msg = await client.beta.messages.create({
    model: FILES_MODEL,
    max_tokens: 2000,
    thinking: { type: "between_tools" },
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: FILES_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [fillTool(countries)],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: [
          ...files.map((f) =>
            f.mediaType === "application/pdf"
              ? ({ type: "document", source: { type: "base64", media_type: f.mediaType, data: f.data } } as const)
              : ({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } } as const),
          ),
          { type: "text", text: `Today is ${today.toISOString().slice(0, 10)}.\n\n${sentence ? `The student's sentence:\n${sentence}` : "The student typed no sentence."}` },
        ],
      },
    ],
  });
  const call = msg.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use");
  if (!call) return { patch: {}, budgetFrom: null, field: null };
  return clean(call.input as ProfileToolInput, new Set(countries), today);
}
