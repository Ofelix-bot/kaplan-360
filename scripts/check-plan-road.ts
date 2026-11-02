// Checks /plan's road (lib/plan-road.ts) on the example students and a few variants, with the data the
// page gathers (lib/plan-data.ts, lib/plan-input.ts) read from data/raw instead of Supabase, on a fixed
// day. Asserts that every item sits in exactly one place, windows never end before they start, nothing
// lies in the past except steps under way, Now shows at most 3 rows, there are at most 8 stops, Mei's
// Portsmouth Chancellor's round falls in Nov 2029 and every round before its university's start, the
// visa step is not in the past and runs to the last start, the calendar file carries reminders and no
// past dates, awards are listed once and only to students who can get them, application dates are the
// student's own programmes' and said once, late windows name the late universities, no item, line or
// calendar entry says how a date was worked out ("… — Kaplan 360++’s rule."), Arjun's
// UCD degree and shortlist load, and Mei's road keeps to its word budget. Prints Mei's and Arjun's roads
// (every plan's with --all).
// Usage: npx tsx scripts/check-plan-road.ts [--all]

import { readFileSync } from "node:fs";
import path from "node:path";
import { shownBenefit } from "./data/benefit-display.mjs";
import { programmeZh, universityZh } from "../lib/data/chinese-names";
import { fixedName } from "../lib/data/fixes";
import { PERSONAS } from "../lib/personas";
import { planIcs } from "../lib/plan-files";
import { planSources, type PlanBenefit } from "../lib/plan-data";
import { planInput } from "../lib/plan-input";
import { roadPlaces, toRoad, NOW_ROWS, type Road, type RoadEntry } from "../lib/plan-road";
import type { PlanAnswers } from "../lib/plan-storage";
import { buildPlan, monthLabel, monthOf, type Plan } from "../lib/plan-timeline";
import { plannedDegree } from "../lib/plan-input";
import type { ResultsData, ResultsProgramme, ResultsUniversity } from "../lib/results-types";

const TODAY = "2026-10-25";
const ROOT = path.resolve(import.meta.dirname, "..");
const raw = <T>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, "data/raw", f), "utf8")) as T;

// Institutions and programmes as lib/data/results.ts reads them from Supabase (loaded from these
// files by scripts/data/load-supabase.mjs): tier-1 universities, programmes with a field, and only the
// fields the plan uses.
type RawInstitution = { id: string; name: string; country: string | null; tier: number };
type RawProgramme = {
  id: string;
  institutionId: string;
  name: string;
  discipline: string | null;
  intakes: string | null;
  tuition: { amount: number | null; currency: string | null; basis: string | null; international: boolean } | null;
  ieltsOverall: number | null;
  gre: { status: string; min: number | null } | null;
  gmat: { status: string; min: number | null } | null;
  deliveredBy: string | null;
  sourceUrl: string;
  lastVerified: string;
};
type EnglishRead = { required: string; ielts: { overall: number } | null };
const institutions = raw<{ institutions: RawInstitution[] }>("institutions.json").institutions;
const english = raw<{ programmes: Record<string, EnglishRead>; universities?: Record<string, EnglishRead> }>("english-requirements.json");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const intakeMask = (texts: string[]) => {
  let mask = 0;
  for (const t of texts) for (const m of t.toLowerCase().matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g)) mask |= 1 << MONTHS.indexOf(m[1]);
  return mask;
};
const tier1 = institutions.filter((i) => i.tier === 1);
const index = new Map(tier1.map((u, i) => [u.id, i]));
const data: Pick<ResultsData, "programmes" | "universities"> = {
  universities: tier1.map((u) => ({ name: u.name, zh: universityZh(u.id), country: u.country ?? "", qs: null, qsValue: null, partner: false, good: null }) as unknown as ResultsUniversity),
  programmes: raw<{ programmes: RawProgramme[] }>("programmes.json")
    .programmes.filter((r) => index.has(r.institutionId) && r.discipline)
    .map((r) => {
      const own = english.programmes[r.id];
      const general = english.universities?.[r.institutionId];
      const read = own && own.required !== "none" ? own : general && general.required !== "none" ? general : null;
      return {
        id: r.id,
        u: index.get(r.institutionId)!,
        name: fixedName(r.id, r.name),
        zh: programmeZh(r.id),
        discipline: r.discipline!,
        intake: intakeMask(r.intakes ? [r.intakes] : []),
        fee: r.tuition?.international && r.tuition.amount ? { amount: r.tuition.amount, currency: r.tuition.currency, basis: r.tuition.basis } : null,
        ielts: r.ieltsOverall ?? read?.ielts?.overall ?? null,
        gre: r.gre?.status ? r.gre : null,
        gmat: r.gmat?.status ? r.gmat : null,
        kaplan: r.deliveredBy === "kaplan",
        url: r.sourceUrl,
        checked: r.lastVerified,
      } as unknown as ResultsProgramme;
    }),
};

// Benefits as lib/data/benefits.ts reads them: shown on the site (scripts/data/benefit-display.mjs),
// for international students (or alumni) and not research-only.
type RawBenefit = {
  id: string;
  institutionId: string;
  kind: PlanBenefit["kind"];
  title: string;
  value: string | null;
  amount: number | null;
  percent: number | null;
  forInternational: boolean | null;
  postgraduateTaught: boolean | null;
  automatic: boolean | null;
  intake: string | null;
  deadline: string | null;
  eventDate: string | null;
  disciplines: string | null;
  eligibility: string | null;
  url: string;
  checklist: PlanBenefit["checklist"];
};
const benefits: PlanBenefit[] = raw<{ items: RawBenefit[] }>("benefits.json")
  .items.filter((b) => shownBenefit(b) && (b.forInternational !== false || /alumni/i.test(b.title)) && b.postgraduateTaught !== false)
  .map((b) => ({
    id: b.id,
    institution_id: b.institutionId,
    kind: b.kind,
    title: b.title,
    value: b.value,
    amount: b.amount,
    percent: b.percent,
    automatic: b.automatic,
    intake: b.intake,
    deadline: b.deadline,
    event_date: b.eventDate,
    disciplines: b.disciplines,
    eligibility: b.eligibility,
    source_url: b.url,
    checklist: b.checklist ?? null,
  }));
const names = new Map(institutions.map((i) => [i.id, i.name] as const));
const sources = planSources(benefits, names);

// The example students, a citizen, a degree student late for some windows, an empty shortlist, and
// shortlists that once went wrong: a Southampton award whose page names the month applications open
// (not its intake), a UCD master's for a UCD graduate (a Universitas 21 alumni award), an English score
// that covers every start (its university's rule in the heading), and a programme with its own
// application site (NUS MSc in Strategic Analysis and Innovation).
const day = new Date(2026, 9, 25);
const persona = (id: string) => PERSONAS.find((p) => p.id === id)!.answers(day);
const cases: { name: string; answers: PlanAnswers }[] = [
  { name: "Mei", answers: persona("mei") },
  { name: "Arjun", answers: persona("arjun") },
  { name: "Lin", answers: persona("lin") },
  { name: "Mei, citizen/PR", answers: { ...persona("mei"), status: "citizen-pr" } },
  { name: "Arjun, no test date or status", answers: { ...persona("arjun"), status: null, englishTestMonth: null, englishTestYear: null } },
  { name: "Mei, empty shortlist", answers: { ...persona("mei"), shortlist: [] } },
  { name: "Arjun, Southampton", answers: { ...persona("arjun"), shortlist: ["university-of-southampton-management-msc"] } },
  { name: "Mei, with UCD", answers: { ...persona("mei"), shortlist: [...persona("mei").shortlist, "university-college-dublin-business-analytics-and-ai"] } },
  { name: "Arjun, Aston", answers: { ...persona("arjun"), shortlist: ["aston-university-finance-msc"] } },
  { name: "Lin, with NUS MSI", answers: { ...persona("lin"), shortlist: [...persona("lin").shortlist, "national-university-of-singapore-msc-in-strategic-analysis-and-innovation-msi"] } },
  // Goals added on Where you stand: an English score (with the tests), a grade (Now: the degree is under way) and a year of work (with the start).
  {
    name: "Mei, with goals",
    answers: {
      ...persona("mei"),
      goals: [
        { id: "a", lever: "ielts", target: 7, by: "2028-09-01", rule: "before-start", start: 2029 * 12 + 8, up: 120 },
        { id: "b", lever: "grade", target: 3.5, unit: "gpa", scale: 4.2, by: "2028-06-01", rule: "graduation", start: 2029 * 12 + 8, up: 40 },
        { id: "c", lever: "work", target: 1, by: "2029-09-01", rule: "start", start: 2029 * 12 + 8, up: 12 },
      ],
    },
  },
];
/** Mei's road with every stop open, in words (the agreed budget is about 650). */
const MEI_WORDS = 650;

const failures: string[] = [];
const check = (who: string, ok: boolean, what: string) => {
  if (!ok) failures.push(`${who}: ${what}`);
};

function verify(who: string, plan: Plan, road: Road) {
  const places = roadPlaces(road);
  for (const i of plan.items) {
    const at = places.filter((p) => p.id === i.id);
    check(who, at.length === 1, `${i.id} is in ${at.length} places (${at.map((p) => p.at).join(", ") || "none"})`);
    check(who, !i.to || i.to >= i.from, `${i.id} ends ${i.to} before it starts ${i.from}`);
    check(who, i.from >= TODAY || (!!i.to && i.to >= TODAY), `${i.id} lies in the past (${i.from}–${i.to ?? ""})`);
  }
  for (const p of places) check(who, plan.items.some((i) => i.id === p.id), `the road shows ${p.id}, which is not in the plan`);
  check(who, road.now.rows.length <= NOW_ROWS, `Now has ${road.now.rows.length} rows`);
  check(who, 1 + road.stops.length <= 8, `${1 + road.stops.length} stops`);
  const visa = plan.items.find((i) => i.id === "visa");
  if (visa) check(who, visa.from >= TODAY, `the visa step starts ${visa.from}, in the past`);
  // The offer, visa and housing step runs to the month before the last start.
  const starts = plan.items.filter((i) => i.id.startsWith("start-")).map((i) => i.from).sort();
  if (visa && starts.length) check(who, monthOf(visa.to!) === monthOf(starts.at(-1)!) - 1, `the visa step ends ${visa.to}, not the month before the last start (${starts.at(-1)})`);
  check(who, plan.end >= plan.start, `the plan ends (${plan.end}) before its first start (${plan.start})`);
  // A scholarship round always closes before its university's first start.
  for (const i of plan.items.filter((i) => i.id.startsWith("sch-") && i.due && i.university)) {
    const first = plan.items.filter((s) => s.id.startsWith("start-") && s.university === i.university).map((s) => s.from).sort()[0];
    if (first) check(who, i.due! < first, `${i.id} is due ${i.due}, not before ${i.university}'s start ${first}`);
  }
  // Own-graduate and network alumni awards only for a university's own graduates; a network's never here.
  check(who, !plan.scholarships.some((s) => /universitas 21/i.test(s.title)), "a Universitas 21 alumni award is shown");
  // Awards from an MBA's own page only for an MBA.
  const mbas = new Set(plan.items.filter((i) => i.id.startsWith("start-") && /\bMBA\b|business administration/i.test(i.short)).map((i) => i.university));
  for (const s of plan.scholarships) check(who, !/aston-mba/.test(s.url ?? "") || mbas.has(s.university), `${s.title} (an MBA award) is shown without an MBA`);
  // The same award once: no two cards at a university with the same value and the same page wording.
  for (const s of plan.scholarships)
    check(who, !plan.scholarships.some((q) => q !== s && q.university === s.university && q.value && q.value === s.value && !!q.eligibility && !!s.eligibility && (q.eligibility.includes(s.eligibility) || s.eligibility.includes(q.eligibility))), `${s.title} at ${s.university} is listed twice`);
  // An application date from one programme's own site only for that programme, and each date once.
  const appDates = plan.items.filter((i) => i.id.startsWith("ev-") && i.lane === "applications");
  for (const i of appDates) {
    check(who, !/mscstrategy\.nus|mscadmissions\.engg\.hku|comp\.nus/.test(i.url ?? "") || plan.items.some((s) => s.id.startsWith("start-") && s.url && new URL(s.url).hostname === new URL(i.url!).hostname), `${i.title} (${i.url}) is another programme's date`);
    check(who, appDates.filter((j) => j.university === i.university && j.from === i.from && j.url === i.url && j.short === i.short).length === 1, `${i.title} on ${i.from} is shown twice`);
    check(who, !/^(Deadline|Applications open): /.test(i.short), `"${i.short}" puts a prefix before the page's heading`);
  }
  // Dates from the student's answers are said to the month, and labelled Yours.
  const merit = plan.items.find((i) => i.id === "kaplan-merit");
  if (merit) check(who, merit.basis === "yours", `Kaplan's grades row is ${merit.basis}, though its dates are the diploma's`);
  // A late window names the late universities when the stop has several.
  for (const e of [...road.now.rows, ...road.now.more, ...road.stops].filter((e) => e.late)) {
    const late = [...new Set(e.items.filter((i) => i.late).map((i) => i.university!))];
    const onTime = [...new Set(e.items.filter((i) => !i.late).map((i) => i.university!))].filter((u) => !late.includes(u));
    if (late.length + onTime.length > 1) check(who, late.every((u) => e.lines[0].includes(u)) && onTime.every((u) => !e.lines[0].includes(u)), `the late line "${e.lines[0]}" doesn't name the late universities (${late.join(", ")})`);
    check(who, !e.tip, "a late stop still says when to apply");
  }
  const ics = planIcs(plan, TODAY);
  const dated = [...ics.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map((m) => `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}`);
  check(who, dated.every((d) => d >= TODAY), `the calendar has past dates: ${dated.filter((d) => d < TODAY).join(", ")}`);
  if (plan.items.some((i) => i.due || i.key || i.lane === "events")) check(who, /BEGIN:VALARM[\s\S]*?TRIGGER:-P14D/.test(ics) && /TRIGGER:-P2D/.test(ics), "the calendar has no deadline reminders");
  if (plan.items.some((i) => i.lane === "events")) check(who, /TRIGGER:-PT15H/.test(ics), "the calendar has no event reminders");
  // How a date was worked out is said nowhere: the Estimated label beside it is enough.
  const RULE = /360\+\+’s rule|estimated .+ —/;
  for (const i of plan.items) check(who, !RULE.test(i.detail), `${i.id}'s detail states a rule: "${i.detail}"`);
  for (const e of [...road.now.rows, ...road.now.more, ...road.stops]) for (const l of e.lines) check(who, !RULE.test(l), `the line "${l}" states a rule`);
  check(who, !RULE.test(ics.replace(/\r\n /g, "")), "the calendar file states a rule");
  return { ics, places };
}

/**
 * Words the road's own text comes to with every stop, row and award open, without the page's chrome;
 * closed rounds, the official quotes and each award's "What to prepare" stay behind their own taps
 * (`prepare` counts those). As components/plan/road draws it: a university's only award doesn't repeat
 * the value its row already shows, a row lists no item by name (an event's dates are its links), and a
 * stop doesn't list an item its headline, lines or flag already say.
 */
function words(road: Road, prepare = false): number {
  const n = (s: string | null | undefined) => (s ?? "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const entry = (e: RoadEntry): number =>
    n(e.title) + n(e.when) + 1 + e.lines.reduce((m, l) => m + n(l), 0) + (e.flag ? n(e.flag.text) : 0) + n(e.tip) +
    n(e.shared) +
    e.items.reduce((m, i) => m + (e.kind === "item" || [e.title, ...e.lines, e.flag?.text].includes(i.short) ? 0 : n(i.short)) + (e.shared ? 0 : n(i.detail)) + (i.rules ?? []).reduce((k, r) => k + n(r.label), 0) + (i.links ?? []).reduce((k, l) => k + n(l.label), 0), 0) +
    e.rows.reduce((m, r) => m + entry(r), 0) +
    e.awards.reduce(
      (m, g) =>
        m + n(g.university) + n(g.summary) +
        g.open.reduce(
          (k, sec) =>
            k + n(sec.label) +
            sec.awards.reduce((j, a) => j + n(a.card.title) + (g.count === 1 && a.card.value === g.top ? 0 : n(a.card.value)) + (sec.kind === "dated" ? n(a.when) : 0) + n(a.card.note) + (prepare ? a.card.prepare.reduce((h, l) => h + n(l), 0) : 0), 0),
          0,
        ),
      0,
    );
  return n(road.now.label) + n(road.now.work?.line) + (prepare ? n(road.now.work?.detail) : 0) + [...road.now.rows, ...road.now.more, ...road.stops].reduce((m, e) => m + entry(e), 0) + road.meta.reduce((m, i) => m + n(i.short), 0);
}

function dump(name: string, plan: Plan, road: Road, ics: string) {
  const entry = (e: RoadEntry, pad: string) => {
    const lines = [`${pad}${e.when} · ${e.basis} · ${e.title}${e.flag ? `   ! ${e.flag.text} (${e.flag.basis})` : ""}`];
    for (const l of e.lines) lines.push(`${pad}    ${l}`);
    if (e.asks.length) lines.push(`${pad}    asks: ${e.asks.join(", ")}`);
    if (e.kind !== "item" || e.items.length > 1) for (const i of e.items) lines.push(`${pad}    - ${i.short} (${i.basis})${i.url ? " ↗" : ""}`);
    if (e.tip) lines.push(`${pad}    tip: ${e.tip}`);
    for (const r of e.rows) lines.push(...entry(r, `${pad}    + `));
    for (const g of e.awards) {
      lines.push(`${pad}    $ ${g.university} · ${g.summary}${g.first ? ` · ${g.first.text}` : ""}${g.closed.length ? ` · ${g.closed.length} closed` : ""}`);
      for (const sec of g.open) {
        if (sec.label) lines.push(`${pad}        ${sec.label}:`);
        for (const a of sec.awards) lines.push(`${pad}        ${sec.label ? "  " : ""}${a.card.title}${a.card.value ? ` · ${a.card.value}` : ""}${sec.kind === "dated" ? ` · ${a.when} (${a.basis})` : ""}${a.card.note ? ` [${a.card.note}]` : ""}`);
      }
      for (const a of g.closed) lines.push(`${pad}        (closed) ${a.card.title} · ${a.when}`);
    }
    return lines;
  };
  const out = [`\n=== ${name}: master's ${monthLabel(plan.start)}${plan.end > plan.start ? `–${monthLabel(plan.end)}` : ""} (${road.stops.length + 1} stops, ${plan.items.length} items, ${plan.scholarships.length} awards, ${(ics.match(/BEGIN:VEVENT/g) ?? []).length} calendar entries, ${(ics.match(/BEGIN:VALARM/g) ?? []).length} reminders, about ${words(road)} words with every stop open, ${words(road, true) - words(road)} more behind "What to prepare")`];
  out.push(`NOW · ${road.now.label}${road.now.asks.length ? ` · asks: ${road.now.asks.join(", ")}` : ""}`);
  if (road.now.work) out.push(`    ${road.now.work.line}${road.now.work.rule ? ` · ${road.now.work.rule.label} ▾` : ""}`);
  for (const e of road.now.rows) out.push(...entry(e, "  "));
  if (road.now.more.length) {
    out.push(`  ${road.now.more.length} more:`);
    for (const e of road.now.more) out.push(...entry(e, "  … "));
  }
  for (const s of road.stops) out.push(...entry(s, "○ "));
  if (road.meta.length) out.push(`meta: ${road.meta.map((i) => i.short).join(" · ")}`);
  console.log(out.join("\n"));
}

for (const c of cases) {
  const plan = buildPlan(planInput({ today: TODAY, answers: c.answers, data, sources }));
  const road = toRoad(plan, TODAY);
  const { ics } = verify(c.name, plan, road);
  if (c.name === "Mei") {
    const card = plan.scholarships.find((s) => /Chancellor's Global Academic Merit/i.test(s.title));
    check(c.name, !!card && !!card.due && card.due >= "2029-10-01" && card.due <= "2029-12-31", `Portsmouth Chancellor's round is ${card?.due ?? "missing"}, not about Nov 2029`);
    check(c.name, !plan.scholarships.some((s) => /alumni/i.test(s.title)), "an alumni award is shown to someone who isn't that university's graduate");
    check(c.name, words(road) <= MEI_WORDS, `the road comes to ${words(road)} words with every stop open (budget ${MEI_WORDS})`);
  }
  if (c.name === "Arjun") {
    check(c.name, [...road.now.rows, ...road.now.more].some((e) => e.late && e.lines.length === 2), "the late application window is not in Now with its two lines");
    // His UCD finance top-up is a Kaplan degree, whose partner's activities are his; his three programmes all load.
    const degree = plannedDegree(c.answers, sources.kaplan);
    check(c.name, degree?.university === "University College Dublin", `his programme ${c.answers.programmeId} is not a Kaplan UCD degree (${degree?.university ?? "not found"})`);
    check(c.name, plan.items.some((i) => i.id === "act-ucd-advantage-award"), "the UCD Advantage Award is not in his plan");
    check(c.name, plan.items.filter((i) => i.id.startsWith("start-")).length === c.answers.shortlist.length, `${plan.items.filter((i) => i.id.startsWith("start-")).length} of his ${c.answers.shortlist.length} programmes load`);
  }
  if (c.name === "Arjun, Southampton") {
    // Its page says "Scholarship applications open in October 2026": the 30 Apr 2027 deadline is the student's own round.
    const card = plan.scholarships.find((s) => /Social Sciences Global Talent Award$/.test(s.title));
    check(c.name, !!card && card.due === "2027-04-30" && card.dueBasis === "official", `Southampton's Global Talent round is ${card?.due ?? "missing"} (${card?.dueBasis}), not 30 Apr 2027 (official)`);
  }
  if (c.name === "Mei, with goals") {
    // Each goal is a "Yours" row inside the stop it serves.
    const hostOf = (id: string) => [...road.now.rows, ...road.now.more, ...road.stops].find((e) => e.rows.some((r) => r.id.startsWith(`goal-${id}-`)))?.kind ?? "none";
    check(c.name, plan.items.filter((i) => i.id.startsWith("goal-")).every((i) => i.basis === "yours" && !!i.due), "a goal is not the student's own dated item");
    check(c.name, hostOf("ielts") === "tests" || !road.stops.some((e) => e.kind === "tests"), `the IELTS goal is in ${hostOf("ielts")}, not with the tests`);
    check(c.name, hostOf("work") === "start", `the work goal is in ${hostOf("work")}, not with the start`);
  }
  if (c.name === "Arjun, Aston") check(c.name, road.meta.some((i) => i.rules?.length), "Aston's English-test rule is not carried to the heading");
  if (c.name === "Mei" || c.name === "Arjun" || process.argv.includes("--all")) dump(c.name, plan, road, ics);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`\nAll checks passed for ${cases.length} plans (today ${TODAY}).`);
