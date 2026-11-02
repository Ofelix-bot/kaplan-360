// The /plan page as one road (components/plan): the plan's items (lib/plan-timeline.ts) laid out as a
// "Now" stop on top, open on load, and the later stops in date order, each one closed row that opens in
// place. Now holds what is running today or starts within four months (three rows, then "N more"); a
// later stop whose first step falls in that window moves into Now whole. Every item sits in exactly one
// place, and scholarships sit inside the stop of the application they go with, one group per
// university with closed rounds set aside. Pure: the same plan and day always give the same road.

import { monthName, monthYear } from "@/lib/i18n/format";
import { makeT, type T } from "@/lib/i18n/translate";
import { addMonths, monthOf, type Basis, type Plan, type PlanAsk, type PlanItem, type PlanScholarshipCard } from "@/lib/plan-timeline";

export type RoadKind = "gap" | "tests" | "degree" | "apply" | "visa" | "start";

/** One key date beside a headline ("! Your 6.5 expires Mar 2028"), with the item it comes from (which sits in the same stop). */
export type RoadFlag = { text: string; date: string; basis: Basis; item: PlanItem | null };

/** An award as a row: its card (title, value, link, what to prepare), its date line and that date's basis (none when undated or automatic). */
export type RoadAward = { card: PlanScholarshipCard; when: string; basis: Basis | null };

/**
 * Open awards of one kind under a heading said once: dated ones (each with its own date, no heading),
 * then "No date: apply with your programme", then "Automatic: no form needed".
 */
export type RoadAwardSection = { kind: "dated" | "undated" | "automatic"; label: string | null; awards: RoadAward[] };

/** One university's awards inside a stop: a closed row ("Aston University · 7 awards · up to £12,500") that opens to them. */
export type RoadAwards = {
  /** In the page's language. */
  university: string;
  /** Open awards (not closed). */
  count: number;
  /** The largest open award's value, as the page words it. */
  top: string | null;
  summary: string;
  /** The first open award's date. */
  first: RoadFlag | null;
  /** Dated awards by date, then those with no date, then the automatic ones; largest first within each. */
  open: RoadAwardSection[];
  /** Rounds that have passed for the student's start, kept for next year's reference (hidden behind "{n} closed"). */
  closed: RoadAward[];
  /** The plan items carrying these awards' windows (the PDF's and calendar's). */
  items: PlanItem[];
};

/**
 * A stop, or a row inside one (or in Now). A stop that moved into Now keeps its rows and awards. The
 * date line (`from`, `to`, `when`) is the headline's: Official dates to the day, Estimated and Yours to the month.
 */
export type RoadEntry = {
  id: string;
  /** A stop, or "item": one item (or the same event on several dates). */
  kind: RoadKind | "item";
  /** Verb first for a stop ("Apply to Aston University and …"). */
  title: string;
  /** Always shown under the headline: an event's university, the late window's two lines. */
  lines: string[];
  from: string;
  to: string | null;
  when: string;
  /** The least certain of its headline items: Estimated, then Yours, then Official. */
  basis: Basis;
  flag: RoadFlag | null;
  /** Its own items, whose details, links and rules show when it opens. */
  items: PlanItem[];
  /** The detail all its items share, said once (the items' own `detail` is then the same text). */
  shared: string | null;
  /** Smaller rows inside it, each opening in place. */
  rows: RoadEntry[];
  awards: RoadAwards[];
  /** Closed award rounds across `awards`. */
  closed: number;
  /** Advice said once for its items ("Apply as soon as it opens…"). */
  tip: string | null;
  /** Answers to ask for here, in a short inline prompt. */
  asks: PlanAsk[];
  /** The usual application window has passed for one of its programmes. */
  late: boolean;
  /** The headline is a page's own words, in English by design (an event's title). */
  lang?: "en";
};

export type Road = {
  now: {
    /** The study stage under way, shown in Now's label ("Diploma to Jun 2027"). */
    anchor: PlanItem | null;
    label: string;
    /** At most three. */
    rows: RoadEntry[];
    /** The rest, behind "N more" (expands in place): later rows within the four months, then this stage's later events. */
    more: RoadEntry[];
    /** The pass's work rule, shown without a tap. */
    work: Plan["work"];
    asks: PlanAsk[];
  };
  /** Later stops in date order; the master's start is always last. */
  stops: RoadEntry[];
  /** Items said in the heading's meta line instead (an English score that covers every start). */
  meta: PlanItem[];
};

/** How far ahead Now looks. */
export const NOW_MONTHS = 4;
/** Rows shown in Now before "N more". */
export const NOW_ROWS = 3;

const UNCERTAIN: Record<Basis, number> = { official: 0, yours: 1, typical: 2 };
const leastCertain = (list: Basis[]): Basis => list.reduce<Basis>((a, b) => (UNCERTAIN[b] > UNCERTAIN[a] ? b : a), "official");

/**
 * The road's date wording: Official dates to the day (except a start, which the page gives as a
 * month), the rest to the month; a window under way reads "to {date}".
 */
function dateWords(today: string, t: T, locale: string) {
  const dayText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const monthText = (d: string) => monthYear(locale, monthOf(d));
  const one = (d: string, byDay: boolean) => (byDay ? dayText(d) : monthText(d));
  const span = (from: string, to: string | null, byDay: boolean) => {
    if (from <= today) return to && to > today ? t("to {date}", { date: one(to, byDay) }) : t("Now");
    if (!to || one(from, byDay) === one(to, byDay)) return one(from, byDay);
    // "Feb – Dec 2028" in English; other languages keep both years.
    if (!byDay && locale.startsWith("en") && from.slice(0, 4) === to.slice(0, 4)) return `${monthName(locale, monthOf(from) % 12)} – ${monthText(to)}`;
    return `${one(from, byDay)} – ${one(to, byDay)}`;
  };
  const byDay = (items: PlanItem[]) => items.every((i) => i.basis === "official" && !i.id.startsWith("start-"));
  return { dayText, monthText, one, span, byDay };
}

/** One item's own date line, worded as the road words its rows ("Jan – Jul 2029", "3 Feb 2027"). */
export function itemWhen(i: PlanItem, today: string, opts: { t?: T; locale?: string } = {}): string {
  const { span, byDay } = dateWords(today, opts.t ?? makeT({}), opts.locale ?? "en-SG");
  return span(i.from, i.to, byDay([i]));
}

export function toRoad(plan: Plan, today: string, opts: { t?: T; locale?: string } = {}): Road {
  const t = opts.t ?? makeT({});
  const locale = opts.locale ?? "en-SG";
  const horizon = addMonths(today, NOW_MONTHS);
  const list = (names: string[], type: "conjunction" | "disjunction" = "conjunction") => new Intl.ListFormat(locale, { style: "long", type }).format(names);
  const { dayText, monthText, one, span, byDay } = dateWords(today, t, locale);
  const flagOf = (item: PlanItem, text: string): RoadFlag => ({ text, date: item.due ?? item.from, basis: item.basis, item });

  const placed = new Set<string>();
  const take = (pred: (i: PlanItem) => boolean) => {
    const out = plan.items.filter((i) => !placed.has(i.id) && pred(i));
    out.forEach((i) => placed.add(i.id));
    return out;
  };
  const isStart = (i: PlanItem) => i.id.startsWith("start-");

  // Now's label: the study stage under way, diploma before degree.
  const running = (i: PlanItem) => i.from <= today && (i.to ?? i.from) >= today;
  const anchor = take((i) => i.id === "diploma" && running(i))[0] ?? take((i) => i.id === "degree" && running(i))[0] ?? null;
  // An English score that already covers every start is said in the heading's meta line, not as a step.
  const meta = take((i) => i.id === "ielts" && i.basis === "yours" && !i.ask);

  /** The detail every item says (the same event on two dates, three programmes opening together), to say once. */
  const sharedDetail = (items: PlanItem[]) => (items.length > 1 && items[0].detail && items.every((i) => i.detail === items[0].detail) ? items[0].detail : null);

  /** One item, or the same event on several dates, as a row. */
  const row = (items: PlanItem[]): RoadEntry => {
    const [i] = items;
    const exact = byDay(items);
    return {
      id: i.id,
      kind: "item",
      title: i.short,
      lines: i.university && !i.short.includes(i.university) ? [i.university] : [],
      from: i.from,
      to: items.length > 1 ? null : i.to,
      when: items.length > 1 ? list(items.map((x) => one(x.from, exact)), "disjunction") : span(i.from, i.to, exact),
      basis: leastCertain(items.map((x) => x.basis)),
      flag: null,
      items,
      shared: sharedDetail(items),
      rows: [],
      awards: [],
      closed: 0,
      tip: null,
      asks: i.ask ? [i.ask] : [],
      late: false,
      lang: items.every((x) => x.lang === "en") ? "en" : undefined,
    };
  };

  /** A university's awards, open ones first by date, largest first within the same kind of date. */
  const awardGroups = (cards: PlanScholarshipCard[]): RoadAwards[] => {
    const groups = new Map<string, PlanScholarshipCard[]>();
    for (const c of cards) groups.set(c.university, [...(groups.get(c.university) ?? []), c]);
    const rank = { upcoming: 0, "last-round": 0, undated: 1, automatic: 2, closed: 3 } as const;
    const out = [...groups].map(([, list]): RoadAwards => {
      const sorted = [...list].sort((p, q) => rank[p.status] - rank[q.status] || (p.due ?? "").localeCompare(q.due ?? "") || q.worth - p.worth);
      const award = (card: PlanScholarshipCard): RoadAward => ({ card, when: card.when, basis: card.status === "closed" || card.status === "undated" || card.status === "automatic" ? null : card.dueBasis });
      const open = sorted.filter((c) => c.status !== "closed");
      const closed = sorted.filter((c) => c.status === "closed");
      // A value too long for the row ("The NIHR INSIGHT programme funding pays your tuition fees and …") stays on its award.
      const largest = [...open].sort((p, q) => q.worth - p.worth).find((c) => c.value)?.value ?? null;
      const top = largest && largest.length <= 80 ? largest : null;
      const ids = new Set(open.map((c) => c.item).filter(Boolean));
      const items = take((i) => ids.has(i.id));
      const dated = open.find((c) => c.due);
      const university = list[0].school;
      const count = open.length;
      // "Aston University · 6 awards · incl. full funding", "University of Portsmouth · 3 awards · largest: £5,000 fee reduction".
      const full = open.some((c) => c.worth >= 1e9);
      return {
        university,
        count,
        top,
        summary: [count === 1 ? t("1 award") : t("{n} awards", { n: count }), count === 1 ? top : full ? t("incl. full funding") : top && t("largest: {value}", { value: top })].filter(Boolean).join(" · "),
        first: dated
          ? { text: t("First award closes {date}", { date: one(dated.due!, dated.dueBasis === "official") }), date: dated.due!, basis: dated.dueBasis!, item: items.find((i) => i.id === dated.item) ?? null }
          : null,
        open: (["dated", "undated", "automatic"] as const)
          .map((kind) => ({
            kind,
            label: kind === "dated" ? null : kind === "undated" ? t("No date: apply with your programme") : t("Automatic: no form needed"),
            awards: open.filter((c) => (c.status === "undated" ? "undated" : c.status === "automatic" ? "automatic" : "dated") === kind).map(award),
          }))
          .filter((x) => x.awards.length),
        closed: closed.map(award),
        items,
      };
    });
    // Universities whose first award closes soonest first, then those with the most awards.
    return out.sort((p, q) => (p.first?.date ?? "9999").localeCompare(q.first?.date ?? "9999") || q.count - p.count);
  };

  /** A stop from its headline items, with rows, awards and a flag; null when it has no headline. */
  const stop = (kind: RoadKind, head: PlanItem[], title: (head: PlanItem[]) => string, extra: { rows?: PlanItem[][]; awards?: RoadAwards[]; flag?: RoadFlag | null } = {}): RoadEntry | null => {
    if (!head.length) return null;
    const rows = (extra.rows ?? []).filter((r) => r.length).map(row);
    const shown = [...head, ...rows.flatMap((r) => r.items)];
    const from = shown.reduce((m, i) => (i.from < m ? i.from : m), shown[0].from);
    const to = shown.reduce<string | null>((m, i) => ((i.to ?? i.from) > (m ?? "") ? (i.to ?? i.from) : m), null);
    const awards = extra.awards ?? [];
    const late = head.filter((i) => i.late);
    // With more than one university in the stop, the lines name the late ones, and each one's next intake.
    const several = new Set(head.map((i) => i.university)).size > 1;
    const lateLines = () => {
      const first = several
        ? t("The application window has passed for {list}: check their pages this week.", { list: universities(late) })
        : t("The application window has passed: check the official page this week.");
      if (!several && late.length === 1) return [first, late[0].late!.note];
      const next = [...new Set(late.filter((i) => i.late!.next != null).map((i) => t("{date} at {university}", { date: monthYear(locale, i.late!.next!, "long"), university: i.university ?? "" })))];
      const unknown = late.filter((i) => i.late!.next == null);
      return [
        first,
        !next.length
          ? t("If it has closed, check the page for the next intake.")
          : unknown.length
            ? t("If it has closed, the next intake is {list}; for {others}, check the page.", { list: list(next), others: universities(unknown) })
            : t("If it has closed, the next intake is {list}.", { list: list(next) }),
      ];
    };
    const lines = late.length ? lateLines() : [];
    // Advice said once for its items; none beside a late window, whose lines say what to do.
    const tips = [...new Set(head.map((i) => i.tip ?? null))];
    const tip = late.length || !head.some((i) => i.tip) ? null : tips.length === 1 ? tips[0] : t("Apply as soon as it opens, even before you meet every condition: many universities make conditional offers.");
    return {
      id: kind,
      kind,
      title: title(head),
      lines,
      from,
      to: to && to > from ? to : null,
      when: span(from, to && to > from ? to : null, byDay(shown)),
      basis: leastCertain(head.map((i) => i.basis)),
      flag: extra.flag ?? null,
      items: head,
      shared: sharedDetail(head),
      rows,
      awards,
      closed: awards.reduce((n, g) => n + g.closed.length, 0),
      tip,
      asks: [],
      late: late.length > 0,
    };
  };
  /** "Aston University, University of Portsmouth and Birmingham City University", or "4 universities". */
  const universities = (items: PlanItem[]) => {
    const names = [...new Set(items.map((i) => i.university).filter((u): u is string => !!u))];
    return names.length > 3 ? t("{n} universities", { n: names.length }) : list(names);
  };

  // The degree after the diploma, when it is still ahead: its activities and the awards that go with it.
  const degreeHead = take((i) => i.id === "degree" && i.from > today);
  const degreeCards = plan.scholarships.filter((c) => c.for === "degree");
  const degree = stop("degree", degreeHead, (h) => h[0].short, {
    rows: degreeHead.length ? [...take((i) => i.id.startsWith("act-")).map((i) => [i]), take((i) => i.id === "scholarship-documents" && i.for === "degree")] : [],
    awards: degreeHead.length ? awardGroups(degreeCards) : [],
  });
  // "Start your degree at …" is dated by its start; its rows keep their own dates.
  if (degree) Object.assign(degree, { to: null, when: one(degreeHead[0].from, byDay(degreeHead)) });
  // Applications: the programmes' windows, documents, official application dates and the master's awards
  // (with the degree's, when the degree is already under way).
  const applyHead = take((i) => i.id.startsWith("apply-"));
  const apply = stop("apply", applyHead, (h) => (h.some((i) => i.late) ? t("Apply now: {list}", { list: universities(h) }) : t("Apply to {list}", { list: universities(h) })), {
    rows: applyHead.length
      ? [
          take((i) => i.id === "documents"),
          ...take((i) => i.id.startsWith("ev-") && (i.lane === "applications" || i.lane === "scholarships")).map((i) => [i]),
          take((i) => i.id === "scholarship-documents"),
        ]
      : [],
    awards: applyHead.length ? awardGroups(plan.scholarships.filter((c) => c.for === "masters" || !degree)) : [],
  });
  if (apply) {
    const dates = [
      ...apply.awards.flatMap((g) => (g.first ? [g.first] : [])),
      ...apply.rows.flatMap((r) => r.items.filter((i) => i.due && i.basis === "official").map((i) => flagOf(i, t("Next deadline {date}", { date: dayText(i.due!) })))),
    ].sort((p, q) => p.date.localeCompare(q.date));
    apply.flag = dates[0] ?? null;
  }
  // Tests: the English test to take or retake (flagged with the date the current one expires), GRE, GMAT.
  const expiry = take((i) => i.id === "ielts-expires")[0];
  const testHead = take((i) => (i.id === "ielts" && !i.ask) || i.id === "gre" || i.id === "gmat");
  // The expiry opens with the retake window it explains.
  const tests = stop("tests", [...testHead.slice(0, 1), ...(expiry && testHead.length ? [expiry] : [])], (h) => h[0].short, {
    rows: testHead.slice(1).map((i) => [i]),
    flag: expiry ? flagOf(expiry, expiry.short) : null,
  });
  if (expiry && !tests) placed.delete(expiry.id);
  const gap = stop("gap", take((i) => i.id === "gap-internship"), (h) => h[0].short);
  const visa = stop("visa", take((i) => i.id === "visa"), (h) => h[0].short);
  const startHead = take(isStart).sort((p, q) => p.from.localeCompare(q.from));
  const start = stop("start", startHead, () => t("Start your master’s"));
  // The student's own goals (Where you stand), placed once the stops are sorted below.
  const goals = take((i) => i.id.startsWith("goal-")).map((i) => row([i]));

  // Everything else is one row, the same event on several dates merged: online experience, Kaplan's
  // award to keep up, events, a test date to check, activities with no degree stop.
  const loose: RoadEntry[] = [];
  const events = new Map<string, PlanItem[]>();
  for (const i of take(() => true)) {
    if (i.lane === "events") events.set(`${i.university}|${i.short}`, [...(events.get(`${i.university}|${i.short}`) ?? []), i]);
    else loose.push(row([i]));
  }
  for (const list of events.values()) loose.push(row(list.sort((p, q) => p.from.localeCompare(q.from))));

  // Where each stop starts for Now: its earliest step, awards included.
  const startsAt = (e: RoadEntry) =>
    [e.from, ...e.awards.flatMap((g) => g.items.map((i) => i.from)), ...(e.flag?.item ? [e.flag.item.from] : [])].reduce((m, d) => (d < m ? d : m));
  const later: RoadEntry[] = [];
  const now: RoadEntry[] = [];
  for (const e of [gap, tests, degree, apply, visa].filter((e): e is RoadEntry => !!e)) (startsAt(e) <= horizon ? now : later).push(e);
  later.sort((p, q) => p.from.localeCompare(q.from));
  const beyond: RoadEntry[] = [];
  for (const e of loose) {
    if (e.from <= horizon) now.push(e);
    else {
      // A later event goes in the stop under way on its date; before every later stop, under "N more".
      const host = [...later].reverse().find((s) => s.from <= e.from);
      if (host) host.rows.push(e);
      else beyond.push(e);
    }
  }
  // Each goal in the stop it serves: an English score with the tests, a grade with the degree, an
  // internship or research in the gap, years of work and a later start with the master's start. Without
  // that stop, the stop under way on its date; else Now.
  // Key skills from /careers: a Kaplan module with the degree, one outside the courses in the gap.
  const serves: Record<string, RoadEntry | null> = { ielts: tests, grade: degree, internship: gap, research: gap, work: start, later: start, module: degree, skill: gap };
  for (const g of goals) {
    const due = g.items[0].due ?? g.from;
    const host = serves[g.id.split("-")[1]] ?? [...later, ...(start ? [start] : [])].reverse().find((s) => s.from <= due) ?? null;
    if (host) host.rows.push(g);
    else now.push(g);
  }
  for (const s of later) s.rows.sort((p, q) => p.from.localeCompare(q.from));

  // Now's order: a window that has passed, then key dates inside the four months by date, then the
  // rest by date, and experience that runs any time last.
  const keyDate = (e: RoadEntry) => (e.flag && e.flag.date <= horizon ? e.flag.date : e.items.find((i) => i.key && i.due && i.due <= horizon)?.due ?? null);
  const anyTime = (e: RoadEntry) => e.kind === "item" && e.items.every((i) => i.lane === "experience" && !i.due);
  const rank = (e: RoadEntry) => (e.late ? 0 : keyDate(e) ? 1 : anyTime(e) ? 3 : 2);
  now.sort((p, q) => rank(p) - rank(q) || (keyDate(p) ?? "").localeCompare(keyDate(q) ?? "") || startsAt(p).localeCompare(startsAt(q)) || (p.to ?? p.from).localeCompare(q.to ?? q.from));

  // Answers still missing are asked where they are used: the English test in its stop (or in Now when
  // there is none), the rest in Now. An item that asks for one itself (a test date to check) needs no other.
  const nowAsks = plan.asks.filter((a) => a === "graduation" || a === "status");
  for (const a of plan.asks.filter((a) => (a === "english-test" || a === "english-date") && !plan.items.some((i) => i.ask === a))) (tests ? tests.asks : nowAsks).push(a);

  const stops = [...later, ...(start ? [start] : [])];
  return {
    now: {
      anchor,
      label: !anchor ? "" : anchor.id === "diploma" ? t("Diploma to {date}", { date: monthText(anchor.to ?? anchor.from) }) : t("Degree to {date}", { date: monthText(anchor.to ?? anchor.from) }),
      rows: now.slice(0, NOW_ROWS),
      more: [...now.slice(NOW_ROWS), ...beyond],
      work: plan.work,
      asks: nowAsks,
    },
    stops,
    meta,
  };
}

/** Every item the road shows, with where it is: for checks that each item sits in exactly one place. */
export function roadPlaces(road: Road): { id: string; at: string }[] {
  const out: { id: string; at: string }[] = [];
  const walk = (e: RoadEntry, at: string) => {
    e.items.forEach((i) => out.push({ id: i.id, at }));
    e.awards.forEach((g) => g.items.forEach((i) => out.push({ id: i.id, at: `${at} awards` })));
    e.rows.forEach((r) => walk(r, at));
  };
  if (road.now.anchor) out.push({ id: road.now.anchor.id, at: "now label" });
  road.now.rows.forEach((e) => walk(e, "now"));
  road.now.more.forEach((e) => walk(e, "now more"));
  road.stops.forEach((e) => walk(e, e.id));
  road.meta.forEach((i) => out.push({ id: i.id, at: "meta" }));
  return out;
}
