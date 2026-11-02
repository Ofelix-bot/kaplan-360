// The timeline: a leaf's state at this month, +12 and +24, worked out by one small state machine per
// kind of road from the student's dates (the degree's end, the master's start) and the leaf's own
// (applications opening, course length). Each step's text is at most LINE_MAX characters in English
// and says what it rests on: an official date with its page, the student's answer, or Kaplan 360++'s
// rule stated in full.

import { msg } from "@/lib/i18n/translate";
import { monthMsg, STEP_OFFSETS, type Basis, type Msg, type Step } from "./types";

/** A message (lib/stand/types.ts Msg); named tr so scripts/i18n/extract.mjs collects its keys. */
const tr = (key: string, vars?: Msg["vars"]): Msg => (vars ? { key, vars } : { key });
const rule = (text: Msg): Basis => ({ kind: "rule", text });

/** A dated moment with its basis. */
export type Dated = { month: number; basis: Basis };

/** The student's own dates, shared by every road. */
export type StepDates = {
  /** This month (year × 12 + month index). */
  now: number;
  /** The month the bachelor's ends (null: no graduation month given). */
  degreeEnd: Dated | null;
  /** A diploma student's diploma end (their graduation month) and the planned top-up degree's start. */
  diploma?: { end: Dated; topUp: Dated } | null;
};

/** A master's on the timeline: when applications open, when it starts, how long it runs. */
export type StudyDates = { opens: Dated; start: Dated; months: { n: number; basis: Basis }; work?: { years: number } };

/** The months before the end of the degree in which it reads "Final term". */
const FINAL_TERM = 6;
const WORK_COUNT = rule(tr("Years of work counted from the month after your degree ends"));
const NO_GRADUATION: Basis = { kind: "yours", text: tr("Add your graduation month to date this") };

/** The moments the timeline shows. */
const moments = (now: number) => STEP_OFFSETS.map((offset) => ({ offset, month: now + offset }));

/**
 * While the degree runs: "Final term" in its last six months, else "Studying until". A diploma student
 * reads "Diploma until {month}", then "Top-up starts {month}", "Top-up degree under way" and, in the
 * degree's last 12 months, "Top-up degree, ends {month}": each with the date it rests on.
 */
function studying(m: number, d: StepDates): { text: Msg; basis: Basis } {
  const end = d.degreeEnd!;
  const left = end.month - m;
  if (left < FINAL_TERM) return { text: tr("Final term until {month}", { month: monthMsg(end.month) }), basis: end.basis };
  const dip = d.diploma;
  if (!dip) return { text: tr("Studying until {month}", { month: monthMsg(end.month) }), basis: end.basis };
  if (m <= dip.end.month) return { text: tr("Diploma until {month}", { month: monthMsg(dip.end.month) }), basis: dip.end.basis };
  if (m < dip.topUp.month) return { text: tr("Top-up starts {month}", { month: monthMsg(dip.topUp.month) }), basis: dip.topUp.basis };
  if (left < 12) return { text: tr("Top-up degree, ends {month}", { month: monthMsg(end.month) }), basis: end.basis };
  return { text: tr("Top-up degree under way"), basis: end.basis };
}

/** The last moment the timeline shows. */
const lastMoment = (d: StepDates) => d.now + STEP_OFFSETS[STEP_OFFSETS.length - 1];

/**
 * When a leaf's next date lies past +24, the three moments show where the student is (the degree, the
 * years of work) and the last one carries that date as its second line, so no point repeats it.
 */
function withLater(steps: Step[], later: { text: Msg; basis: Basis }): Step[] {
  const last = steps[steps.length - 1];
  if (last.also || last.text.key === later.text.key) return steps;
  return [...steps.slice(0, -1), { ...last, also: later.text, alsoBasis: later.basis }];
}

/** Year n of work, n from 1 in the month after the degree ends. */
const workYear = (m: number, end: number) => Math.floor((m - end - 1) / 12) + 1;

/** A master's from opening to done: the shared tail of every study-like road. */
function masters(m: number, s: StudyDates): { text: Msg; basis: Basis } {
  if (m < s.opens.month) return { text: tr("Applications open {month}", { month: monthMsg(s.opens.month) }), basis: s.opens.basis };
  if (m < s.start.month) return { text: tr("Apply · starts {month}", { month: monthMsg(s.start.month) }), basis: s.start.basis };
  const last = s.start.month + s.months.n - 1;
  if (m <= last) return { text: tr("Master’s under way"), basis: s.months.basis };
  return { text: tr("Master’s done · {month}", { month: monthMsg(last) }), basis: s.months.basis };
}

/**
 * A master's leaf. Before applications open: "Applications open {month}"; from opening to the start:
 * "Apply · starts {month}"; during: "Master’s under way"; after: "Master’s done · {month}". A programme
 * that asks for years of work (`work`) first runs the degree and the years of work in between.
 */
export function studySteps(d: StepDates, s: StudyDates): Step[] {
  const beyond = !!d.degreeEnd && s.opens.month > lastMoment(d);
  const steps = moments(d.now).map(({ offset, month }): Step => {
    if ((s.work || beyond) && d.degreeEnd) {
      if (month <= d.degreeEnd.month) return { offset, month, ...studying(month, d) };
      if (s.work && month < s.opens.month) return { offset, month, text: tr("Year {n} of work", { n: workYear(month, d.degreeEnd.month) }), basis: WORK_COUNT };
    }
    return { offset, month, ...masters(month, s) };
  });
  return beyond ? withLater(steps, masters(d.now, s)) : steps;
}

/** How a work leaf words its years of work: plainly, at home, or without CSCSE certification. */
export type WorkWording = "work" | "home" | "uncertified";
const WORK_TEXT: Record<WorkWording, string> = {
  work: msg("Year {n} of work"),
  home: msg("Year {n} of work at home"),
  uncertified: msg("Year {n} · not CSCSE-listed"),
};

/**
 * A work leaf: "Studying until {month}" (in the last six months, "Final term until …") while the
 * degree runs, then "Year {n} of work". `mbas` (the programmes in MBA & work-first that pass every gate
 * with two years of full-time work) goes on the +24 step as a second line once the student is working.
 */
export function workSteps(d: StepDates, wording: WorkWording, mbas?: { n: number; basis: Basis }): Step[] {
  return moments(d.now).map(({ offset, month }) => {
    if (!d.degreeEnd) return { offset, month, text: tr("Add your graduation month"), basis: NO_GRADUATION };
    if (month <= d.degreeEnd.month) return { offset, month, ...studying(month, d) };
    const step: Step = { offset, month, text: tr(WORK_TEXT[wording], { n: workYear(month, d.degreeEnd.month) }), basis: WORK_COUNT };
    if (offset === 24 && mbas) return { ...step, also: tr("2 years: {n} MBAs open", { n: mbas.n }), alsoBasis: mbas.basis };
    return step;
  });
}

/**
 * A qualification leaf: while the degree runs, what the degree brings at graduation (`during`; without
 * one, the degree's own "Studying until"); after, what is left or what holds (`after`). Without the facts every step reads "Missing: data".
 */
export function qualifySteps(d: StepDates, facts: { during?: Msg; after: Msg; basis: Basis } | null): Step[] {
  return moments(d.now).map(({ offset, month }) => {
    if (!facts) return { offset, month, text: tr("Missing: data"), basis: rule(tr("The professional body’s facts for your degree are not collected yet")) };
    if (!d.degreeEnd) return { offset, month, text: facts.after, basis: facts.basis };
    if (month <= d.degreeEnd.month) return { offset, month, ...(facts.during ? { text: facts.during, basis: facts.basis } : studying(month, d)) };
    return { offset, month, text: facts.after, basis: facts.basis };
  });
}

/**
 * "Work a year first": the degree, years of work, then the master's a year later than planned
 * (applications open 12 months before that start).
 */
export function workFirstSteps(d: StepDates, s: StudyDates): Step[] {
  return studySteps(d, { ...s, work: { years: 1 } });
}

/**
 * "One more internship first": the internship is due 12 months before the start (when applications
 * open, Kaplan 360++'s rule, as Where you stand dates the goal), or now when that month has passed;
 * then the master's as planned. `online`: the wording for a student who interns online.
 */
export function internshipSteps(d: StepDates, s: StudyDates, online: boolean): Step[] {
  const dueRule = rule(tr("Due 12 months before your start, when applications open; due now once that month has passed"));
  const due = Math.max(d.now, s.start.month - 12);
  const by = { text: online ? tr("Online internship by {month}", { month: monthMsg(due) }) : tr("Internship by {month}", { month: monthMsg(due) }), basis: dueRule };
  // Due past +24: the degree at each moment, and the internship's date on the last one.
  const beyond = !!d.degreeEnd && due > lastMoment(d);
  const steps = moments(d.now).map(({ offset, month }): Step => {
    if (month === d.now && due === d.now) return { offset, month, text: tr("Internship due now"), basis: dueRule };
    if (beyond && month <= d.degreeEnd!.month) return { offset, month, ...studying(month, d) };
    if (month < due) return { offset, month, ...by };
    return { offset, month, ...masters(month, s) };
  });
  return beyond ? withLater(steps, by) : steps;
}
