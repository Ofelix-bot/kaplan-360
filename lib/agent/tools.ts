import type Anthropic from "@anthropic-ai/sdk";
import { DIRECTIONS } from "@/lib/finder/directions";
import { FEES, REGIONS } from "@/lib/finder/answers";
import { MAX_ASKS, type AskInput, type Claim, type Final, type SaveInput, type SourceRef, type ToolName } from "./types";

// The adviser's nine tools (names from lib/agent/types.ts) as the model sees them, and the checks every input passes
// before anything runs. Not strict: the API compiles a strict schema on first use (13 to 19 s for schemas this size),
// past the time the host gives one call, and again whenever the schema changes. Each input is held to its schema here
// instead; a server tool given an input that fails gets an error result naming what was wrong, and the model can retry.
// The list is the same on every call, in this order, so the prompt cache holds it.

const REGION_IDS = [...REGIONS.map((r) => r.id), "other"];
const DIRECTION_IDS = DIRECTIONS.map((d) => d.id);
const FEE_IDS = FEES.map((f) => f.id);

const claim = (what: string): Anthropic.Tool.InputSchema => ({
  type: "object",
  description: what,
  properties: {
    text: { type: "string", description: "One short line in the page's language. Every number in it appears in a tool result or the student's text." },
    sources: {
      type: "array",
      description: "The ids the tools returned for what the line states; empty only for a line about the student's own words.",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["programme", "employment", "ep", "career", "policy"] },
          id: { type: "string" },
          field: { type: "string", description: "For a programme: the evidence field, e.g. ielts, tuition, duration, intakes, academicRequirement." },
        },
        required: ["kind", "id"],
      },
    },
  },
  required: ["text", "sources"],
});

const claims = (what: string) => ({ type: "array", description: what, items: claim("A claim.") });

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_programmes",
    description:
      "Master's programmes from the site's database that fit the filters you choose, best match first (at most 10). Each row: id, programme, university, country, QS rank, months, tuition a year in S$, IELTS, the student's match band, and risk flags. Omitted filters fall back to what the student chose in the finder.",
    input_schema: {
      type: "object",
      properties: {
        regions: { type: "array", items: { type: "string", enum: REGION_IDS }, description: "Where to study; empty for anywhere." },
        directions: { type: "array", items: { type: "string", enum: DIRECTION_IDS }, description: "Master's directions, at most 3." },
        keyword: { type: "string", description: "A word the programme's name must contain, e.g. fintech." },
        maxMonths: { type: "integer", description: "The longest programme the student accepts." },
        fee: { type: "string", enum: FEE_IDS, description: "Tuition a year in S$: lt30, 30-50, 50-80, gt80." },
        qsMax: { type: "integer", description: "Only universities ranked this or better in QS." },
        kaplanOnly: { type: "boolean", description: "Only master's taught at Kaplan Singapore." },
      },
    },
  },
  {
    name: "admit_rate",
    description:
      "For one programme id from search_programmes: the student's match band (gap, range or strong), the GPA its admitted students usually have, the single change that would move the student to strong, and the programme's own published words about who it admits, with URLs.",
    input_schema: { type: "object", properties: { programmeId: { type: "string" } }, required: ["programmeId"] },
  },
  {
    name: "ep_check",
    description:
      "Whether the student needs a work pass to work in Singapore after graduating, and the Employment Pass minimum qualifying salary for their age and sector (MOM's table). Not needed for a Singapore citizen or permanent resident.",
    input_schema: {
      type: "object",
      properties: { sector: { type: "string", enum: ["financial", "general"], description: "financial for financial services; general otherwise. Omit to use the student's degree." } },
    },
  },
  {
    name: "hot_roles",
    description:
      "Up to 6 in-demand entry roles in Singapore for the student's degree, or for one industry you name: title, MOM's 'needs' and 'high pay' signals, the median wage with its source id, and the key skills. Without a degree on file, name an industryId (an error lists them).",
    input_schema: { type: "object", properties: { industryId: { type: "string" } } },
  },
  {
    name: "skill_gap",
    description:
      "For one role id from hot_roles: the skills the role asks for that the student's degree covers (and by which module), and the ones it doesn't, with their Skills Framework level. fix is degree when an elective of their own degree covers the skill, else outside.",
    input_schema: { type: "object", properties: { roleId: { type: "string" } }, required: ["roleId"] },
  },
  {
    name: "outcomes_figures",
    description:
      "Graduate outcomes from official surveys: Kaplan Singapore's own row, private-degree and public-university employment and median salary in Singapore, the trend, and what a master's changes abroad. Each figure has its record id, survey year and what it measures.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "ask_user",
    description: `Ask the student one short question, only when a missing fact would change the advice. At most ${MAX_ASKS} per run. options: up to 4 short answers shown as buttons.`,
    input_schema: {
      type: "object",
      properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" }, description: "At most 4." } },
      required: ["question", "options"],
    },
  },
  {
    name: "save_to_plan",
    description: "Add programmes to the student's shortlist and skill gaps to their plan. Only ids the tools returned.",
    input_schema: {
      type: "object",
      properties: {
        programmeIds: { type: "array", items: { type: "string" } },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              roleId: { type: "string" },
              role: { type: "string" },
              skill: { type: "string" },
              level: { type: ["integer", "null"] },
              fix: { type: "string", enum: ["degree", "outside"] },
              how: { type: "string" },
            },
            required: ["roleId", "role", "skill", "level", "fix", "how"],
          },
        },
      },
      required: ["programmeIds", "gaps"],
    },
  },
  {
    name: "finish",
    description:
      "End the run with the advice: what you read about the student and found on each side, study on vs start work, a dated roadmap, the skill gaps, and up to 3 programmes. Keep every line short; cite the ids the tools returned.",
    input_schema: {
      type: "object",
      properties: {
        analysis: {
          type: "object",
          properties: {
            you: claims("What you read about the student, at most 3."),
            education: claims("What the education tools found, at most 3."),
            career: claims("What the career tools found, at most 3."),
          },
          required: ["you", "education", "career"],
        },
        decision: {
          type: "object",
          properties: {
            rows: {
              type: "array",
              description: "One row per criterion, at most 4.",
              items: {
                type: "object",
                properties: { criterion: { type: "string", enum: ["cost", "benefit", "risk", "fit"] }, study: claim("Studying on."), work: claim("Starting work.") },
                required: ["criterion", "study", "work"],
              },
            },
            lean: { type: "string", enum: ["study", "work", "both"] },
            why: claim("Why it leans that way, one line."),
          },
          required: ["rows", "lean", "why"],
        },
        roadmap: {
          type: "array",
          description: "Dated steps, at most 6, earliest first.",
          items: {
            type: "object",
            properties: { when: { type: "string", description: "YYYY-MM" }, lane: { type: "string", enum: ["education", "career"] }, text: { type: "string" } },
            required: ["when", "lane", "text"],
          },
        },
        gaps: {
          type: "array",
          description: "From skill_gap, most important first, at most 4.",
          items: {
            type: "object",
            properties: {
              roleId: { type: "string" },
              role: { type: "string" },
              skill: { type: "string" },
              level: { type: ["integer", "null"] },
              fix: { type: "string", enum: ["degree", "outside"] },
              how: { type: "string" },
            },
            required: ["roleId", "role", "skill", "level", "fix", "how"],
          },
        },
        picks: {
          type: "array",
          description: "At most 3 programme ids from search_programmes or admit_rate, best first; empty when the advice is to work first and no master's fits.",
          items: { type: "object", properties: { programmeId: { type: "string" }, reason: { type: "string" } }, required: ["programmeId", "reason"] },
        },
      },
      required: ["analysis", "decision", "roadmap", "gaps", "picks"],
    },
  },
];

// ── input checks ─────────────────────────────────────────────────────────────────────────────────────────

export type SearchInput = { regions?: string[]; directions?: string[]; keyword?: string; maxMonths?: number; fee?: (typeof FEE_IDS)[number]; qsMax?: number; kaplanOnly?: boolean };
export type ProgrammeInput = { programmeId: string };
export type EpInput = { sector?: "financial" | "general" };
export type IndustryInput = { industryId?: string };
export type RoleInput = { roleId: string };

/** A checked input, or what was wrong with it (sent back to the model as an error result). */
export type Checked<T> = { ok: true; input: T } | { ok: false; error: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, max = 20, len = 400) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, len)).slice(0, max) : []);
const intIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const oneOf = <T extends string>(v: unknown, values: readonly T[]) => (typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : undefined);

export function checkSearch(v: unknown): Checked<SearchInput> {
  const x = obj(v);
  const bad = [...strs(x.regions).filter((r) => !REGION_IDS.includes(r)), ...strs(x.directions).filter((d) => !DIRECTION_IDS.includes(d))];
  if (bad.length) return { ok: false, error: `Unknown region or direction: ${bad.join(", ")}. Regions: ${REGION_IDS.join(", ")}. Directions: ${DIRECTION_IDS.join(", ")}.` };
  if (x.fee !== undefined && x.fee !== null && !oneOf(x.fee, FEE_IDS)) return { ok: false, error: `fee is one of ${FEE_IDS.join(", ")}.` };
  return {
    ok: true,
    input: {
      ...(Array.isArray(x.regions) ? { regions: strs(x.regions, REGION_IDS.length) } : {}),
      ...(Array.isArray(x.directions) ? { directions: strs(x.directions, 3) } : {}),
      ...(str(x.keyword, 40) ? { keyword: str(x.keyword, 40) } : {}),
      ...(intIn(x.maxMonths, 6, 48) ? { maxMonths: intIn(x.maxMonths, 6, 48) } : {}),
      ...(oneOf(x.fee, FEE_IDS) ? { fee: oneOf(x.fee, FEE_IDS) } : {}),
      ...(intIn(x.qsMax, 1, 1500) ? { qsMax: intIn(x.qsMax, 1, 1500) } : {}),
      ...(x.kaplanOnly === true ? { kaplanOnly: true } : {}),
    },
  };
}

export function checkProgramme(v: unknown): Checked<ProgrammeInput> {
  const programmeId = str(obj(v).programmeId, 400);
  return programmeId ? { ok: true, input: { programmeId } } : { ok: false, error: "programmeId is required: an id from search_programmes." };
}

export function checkEp(v: unknown): Checked<EpInput> {
  const sector = oneOf(obj(v).sector, ["financial", "general"] as const);
  return { ok: true, input: sector ? { sector } : {} };
}

export function checkIndustry(v: unknown): Checked<IndustryInput> {
  const industryId = str(obj(v).industryId, 100);
  return { ok: true, input: industryId ? { industryId } : {} };
}

export function checkRole(v: unknown): Checked<RoleInput> {
  const roleId = str(obj(v).roleId, 200);
  return roleId ? { ok: true, input: { roleId } } : { ok: false, error: "roleId is required: an id from hot_roles." };
}

export function checkAsk(v: unknown): AskInput | null {
  const x = obj(v);
  const question = str(x.question, 240);
  return question ? { question, options: strs(x.options, 4, 60) } : null;
}

export function checkSave(v: unknown, known: { programmes: Set<string>; roles: Set<string> }, ok: (line: string) => boolean): SaveInput {
  const x = obj(v);
  return { programmeIds: strs(x.programmeIds, 10).filter((id) => known.programmes.has(id)), gaps: gapsOf(x.gaps, known.roles, ok) };
}

const SOURCE_KINDS = ["programme", "employment", "ep", "career", "policy"] as const;

/** "kind:id": the key of a source the tools returned. */
export const sourceKey = (s: Pick<SourceRef, "kind" | "id">) => `${s.kind}:${s.id}`;

function sourcesOf(v: unknown, known: Set<string>): SourceRef[] {
  if (!Array.isArray(v)) return [];
  const out: SourceRef[] = [];
  for (const s of v.slice(0, 6)) {
    const x = obj(s);
    const kind = oneOf(x.kind, SOURCE_KINDS);
    const id = str(x.id, 400);
    if (!kind || !id || !known.has(sourceKey({ kind, id }))) continue;
    const field = str(x.field, 40);
    out.push(field ? { kind, id, field } : { kind, id });
  }
  return out;
}

const NUMBER = /\d/;

/** A claim the page may show: its line passes the check, and it cites only sources the tools returned (a line with a number must cite one). */
function claimOf(v: unknown, known: Set<string>, ok: (line: string) => boolean): Claim | null {
  const x = obj(v);
  const text = str(x.text, 240);
  if (!text || !ok(text)) return null;
  const sources = sourcesOf(x.sources, known);
  if (!sources.length && NUMBER.test(text)) return null;
  return { text, sources };
}

function gapsOf(v: unknown, roles: Set<string>, ok: (line: string) => boolean): Final["gaps"] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 6).flatMap((g): Final["gaps"] => {
    const x = obj(g);
    const roleId = str(x.roleId, 200);
    const fix = oneOf(x.fix, ["degree", "outside"] as const);
    const skill = str(x.skill, 120);
    const role = str(x.role, 120);
    const how = str(x.how, 240);
    if (!roles.has(roleId) || !fix || !skill || !role || (how && !ok(how))) return [];
    return [{ roleId, role, skill, level: intIn(x.level, 1, 7) ?? null, fix, how }];
  });
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * The finish input with only what may be shown: claims whose line passes `ok` and whose sources the tools returned,
 * dated steps in the next five years, gaps for roles the tools returned, and at most 3 picks among the programmes
 * they returned. A row whose either side fails is dropped; a failing `why` becomes an empty line.
 */
export function checkFinal(v: unknown, known: { sources: Set<string>; programmes: Set<string>; roles: Set<string> }, ok: (line: string) => boolean, today: Date): Final {
  const x = obj(v);
  const a = obj(x.analysis);
  const d = obj(x.decision);
  const list = (w: unknown, max: number) => (Array.isArray(w) ? w.slice(0, max).map((c) => claimOf(c, known.sources, ok)).filter((c): c is Claim => !!c) : []);
  const year = today.getFullYear();
  const rows = (Array.isArray(d.rows) ? d.rows : []).slice(0, 4).flatMap((r): Final["decision"]["rows"] => {
    const y = obj(r);
    const criterion = oneOf(y.criterion, ["cost", "benefit", "risk", "fit"] as const);
    const study = claimOf(y.study, known.sources, ok);
    const work = claimOf(y.work, known.sources, ok);
    return criterion && study && work ? [{ criterion, study, work }] : [];
  });
  const roadmap = (Array.isArray(x.roadmap) ? x.roadmap : []).slice(0, 8).flatMap((s): Final["roadmap"] => {
    const y = obj(s);
    const when = str(y.when, 7);
    const m = MONTH.exec(when);
    const lane = oneOf(y.lane, ["education", "career"] as const);
    const text = str(y.text, 240);
    if (!m || Number(m[1]) < year || Number(m[1]) > year + 5 || !lane || !text || !ok(text)) return [];
    return [{ when, lane, text }];
  });
  const picks: Final["picks"] = [];
  for (const p of Array.isArray(x.picks) ? x.picks : []) {
    const y = obj(p);
    const programmeId = str(y.programmeId, 400);
    const reason = str(y.reason, 240);
    if (picks.length >= 3 || !known.programmes.has(programmeId) || picks.some((q) => q.programmeId === programmeId)) continue;
    picks.push({ programmeId, reason: reason && ok(reason) ? reason : "" });
  }
  return {
    analysis: { you: list(a.you, 4), education: list(a.education, 4), career: list(a.career, 4) },
    decision: {
      rows,
      lean: oneOf(d.lean, ["study", "work", "both"] as const) ?? "both",
      why: claimOf(d.why, known.sources, ok) ?? { text: "", sources: [] },
    },
    roadmap: roadmap.sort((p, q) => p.when.localeCompare(q.when)).slice(0, 6),
    gaps: gapsOf(x.gaps, known.roles, ok).slice(0, 4),
    picks,
  };
}

/** The tools that run on the server, and each one's lane on the page. */
export const LANE: Record<ToolName, "education" | "career" | "you"> = {
  search_programmes: "education",
  admit_rate: "education",
  ep_check: "career",
  hot_roles: "career",
  skill_gap: "career",
  outcomes_figures: "career",
  ask_user: "you",
  save_to_plan: "you",
  finish: "you",
};
