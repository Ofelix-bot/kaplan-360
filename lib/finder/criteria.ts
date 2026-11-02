import type { ResultsProgramme, ResultsUniversity, SubjectStanding } from "@/lib/results-types";

// The finder's order. The student picks one or more criteria; one sorts the list by itself, several by the average of
// each programme's percentile on each (equal weights, within the list as shown). A programme with no figure for a
// criterion is kept: last when that criterion sorts alone, the bottom percentile in an average (decided 2026-11-02).

export type Criterion = "match" | "qs" | "fee" | "subject" | "industry";
export const CRITERIA: Criterion[] = ["match", "qs", "fee", "subject", "industry"];
export const DEFAULT_CRITERIA: Criterion[] = ["match"];

/** A university-wide employer score stands in for a missing subject one at this share (decided 2026-11-02). */
export const UNIVERSITY_WIDE_SHARE = 0.9;

type Ranked = { p: ResultsProgramme; u: ResultsUniversity; match: { rate: number } | null };

export const standingOf = (r: Pick<Ranked, "p" | "u">): SubjectStanding | undefined => r.u.subjects[r.p.discipline];

/** QS by Subject first, else GRAS: the rank's first number, so a GRAS rank sits in the QS band it falls in. */
export function subjectOf(r: Pick<Ranked, "p" | "u">): { rank: string; v: number; source: "QS" | "GRAS"; subject: string | null } | null {
  const s = standingOf(r);
  if (s?.qs) return { rank: s.qs.rank, v: s.qs.v, source: "QS", subject: s.qs.subject };
  if (s?.gras) return { rank: s.gras.rank, v: s.gras.v, source: "GRAS", subject: null };
  return null;
}

/** QS's Employer reputation in the subject, else the university's QS 2027 figure at UNIVERSITY_WIDE_SHARE (rank shown as published). */
export function industryOf(r: Pick<Ranked, "p" | "u">): { score: number; rank: string | null; subject: string | null; universityWide: boolean } | null {
  const e = standingOf(r)?.employer;
  if (e) return { score: e.score, rank: e.rank, subject: e.subject, universityWide: false };
  if (r.u.employer) return { score: r.u.employer.score * UNIVERSITY_WIDE_SHARE, rank: r.u.employer.rank, subject: null, universityWide: true };
  return null;
}

/** Lower is better; null when the programme has no figure. */
function key(c: Criterion, r: Ranked): number | null {
  switch (c) {
    case "match":
      return r.match ? -r.match.rate : null;
    case "qs":
      return r.u.qsValue;
    case "fee":
      return r.p.feeSgd;
    case "subject":
      return subjectOf(r)?.v ?? null;
    case "industry": {
      const i = industryOf(r);
      return i ? -i.score : null;
    }
  }
}

const byQsThenName = (a: Ranked, b: Ranked) => (a.u.qsValue ?? 9999) - (b.u.qsValue ?? 9999) || a.p.name.localeCompare(b.p.name);

/** Each row's percentile on one criterion (1 best, 0 worst or no figure); ties share their average place. */
function percentiles(c: Criterion, rows: Ranked[]): Map<Ranked, number> {
  const out = new Map<Ranked, number>();
  const known = rows.map((r) => ({ r, k: key(c, r) })).filter((x): x is { r: Ranked; k: number } => x.k !== null);
  known.sort((a, b) => a.k - b.k);
  const span = Math.max(rows.length - 1, 1);
  for (let i = 0; i < known.length; ) {
    let j = i;
    while (j + 1 < known.length && known[j + 1].k === known[i].k) j++;
    const place = (i + j) / 2;
    for (let x = i; x <= j; x++) out.set(known[x].r, rows.length === 1 ? 1 : 1 - place / span);
    i = j + 1;
  }
  for (const r of rows) if (!out.has(r)) out.set(r, 0);
  return out;
}

/** Sorts in place by the chosen criteria; ties go to the better QS rank, then the name. */
export function sortByCriteria<T extends Ranked>(rows: T[], chosen: Criterion[]): T[] {
  const cs = chosen.length ? chosen : DEFAULT_CRITERIA;
  if (cs.length === 1) {
    const c = cs[0];
    const keys = new Map(rows.map((r) => [r, key(c, r)]));
    return rows.sort((a, b) => {
      const ka = keys.get(a) ?? null;
      const kb = keys.get(b) ?? null;
      if (ka === null || kb === null) return ka === kb ? byQsThenName(a, b) : ka === null ? 1 : -1;
      return ka - kb || byQsThenName(a, b);
    });
  }
  const per = cs.map((c) => percentiles(c, rows));
  const score = new Map(rows.map((r) => [r, per.reduce((s, m) => s + m.get(r)!, 0) / cs.length]));
  return rows.sort((a, b) => score.get(b)! - score.get(a)! || byQsThenName(a, b));
}

/** A kept choice read back: known criteria only, in the fixed order, never empty. */
export function criteriaOf(kept: unknown): Criterion[] {
  const list = Array.isArray(kept) ? CRITERIA.filter((c) => kept.includes(c)) : [];
  return list.length ? list : DEFAULT_CRITERIA;
}

/** Whether COMPASS counts this programme's university for its discipline. */
export function compassFor(r: Pick<Ranked, "p" | "u">): { group: "A" | "B"; faculty: string | null } | null {
  const c = r.u.compass;
  if (!c) return null;
  if (c.group === "A") return { group: "A", faculty: null };
  const f = c.faculties.find((x) => x.disciplines.includes(r.p.discipline));
  return f ? { group: "B", faculty: f.name } : null;
}
