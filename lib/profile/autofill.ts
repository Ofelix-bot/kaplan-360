import { defaultScale, FEES, finderOf, hasEnglish, hasGrade, REGIONS } from "@/lib/finder/answers";
import { directionsSaid } from "@/lib/finder/directions";
import { plannedDegree, type FinderAnswers, type PlanAnswers } from "@/lib/plan-storage";
import { withSentence, type ProfileReading } from "@/lib/profile-reading";
import { hasDegree } from "./progress";

// /profile's autofill (components/profile/AutofillCard.tsx): a reading of the student's words, screenshots or PDFs
// (app/api/profile) put into the answers they haven't given yet. An answer already there is kept; where the reading
// says otherwise it is listed as a conflict, with the patch that would take the reading instead.

/** The profile's groups an autofill can fill (each gets a mark until it is edited). */
export type FillGroup = "degree" | "status" | "grades" | "directions" | "english" | "budget";

export type Conflict = {
  id: "degree" | "graduation" | "status" | "nationality" | "birthYear" | "grade" | "english";
  was: string;
  read: string;
  patch: Partial<PlanAnswers>;
};

export type Autofill = {
  patch: Partial<PlanAnswers>;
  filled: FillGroup[];
  conflicts: Conflict[];
};

/** The answers each group shows, as one string: a group's mark stays while this is unchanged. */
export function groupSnapshot(a: PlanAnswers, g: FillGroup): string {
  const f = finderOf(a);
  const pick: Record<FillGroup, unknown[]> = {
    degree: [a.school, a.programmeId, a.pathwayDegreeId, a.level, a.graduated, a.graduationYear, a.graduationMonth],
    status: [a.sgStatus, a.nationality, a.birthYear],
    grades: [a.classification, a.averageMark, a.degreeGpa],
    directions: [f.directions],
    english: [a.englishTest, a.englishScore, a.englishTestYear, a.englishTestMonth],
    budget: [f.fee, f.regions],
  };
  return JSON.stringify(pick[g]);
}

const DEGREE_KEYS = ["level", "programmeId", "pathwayDegreeId", "school", "schoolDiscipline", "diplomaLevel"] as const;
const bandOf = (budget: number): FinderAnswers["fee"] => FEES.find((b) => budget <= b.max)?.id ?? null;

/**
 * The reading applied to the empty answers only. `university`: the awarding university of a Kaplan degree id (the
 * scale a GPA is read on). Values in conflicts are raw ids and numbers; the card words them.
 */
export function autofill(a: PlanAnswers, reading: ProfileReading, text: string, university: (degreeId: string) => string | null): Autofill {
  const p = reading.patch;
  const patch: Partial<PlanAnswers> = {};
  const filled = new Set<FillGroup>();
  const conflicts: Conflict[] = [];
  const f = finderOf(a);
  const finder: Partial<FinderAnswers> = {};

  // The degree (with what depends on it), as choosing it on the form does.
  if (p.level || p.programmeId || p.school) {
    const degreePatch = {
      level: p.level,
      programmeId: p.programmeId,
      school: p.school,
      schoolDiscipline: p.schoolDiscipline,
    };
    const next = withSentence(a, Object.fromEntries(Object.entries(degreePatch).filter(([, v]) => v !== undefined)));
    if (!hasDegree(a)) {
      for (const k of DEGREE_KEYS) if (next[k] !== a[k]) Object.assign(patch, { [k]: next[k] });
      if (Object.keys(patch).length) filled.add("degree");
    } else if (p.programmeId && p.programmeId !== a.programmeId && p.programmeId !== plannedDegree(a)) {
      const changes: Partial<PlanAnswers> = {};
      for (const k of DEGREE_KEYS) if (next[k] !== a[k]) Object.assign(changes, { [k]: next[k] });
      conflicts.push({
        id: "degree",
        was: plannedDegree(a) ?? "",
        read: p.programmeId,
        patch: changes,
      });
    }
  }

  // Graduation: whether, and when.
  if (p.graduated !== undefined && a.graduated === null) {
    patch.graduated = p.graduated;
    filled.add("degree");
  }
  if (p.graduationYear && p.graduationMonth) {
    if (!a.graduationYear || !a.graduationMonth) {
      Object.assign(patch, {
        graduationYear: p.graduationYear,
        graduationMonth: p.graduationMonth,
      });
      filled.add("degree");
    } else if (a.graduationYear !== p.graduationYear || a.graduationMonth !== p.graduationMonth)
      conflicts.push({
        id: "graduation",
        was: `${a.graduationYear}-${a.graduationMonth}`,
        read: `${p.graduationYear}-${p.graduationMonth}`,
        patch: {
          graduationYear: p.graduationYear,
          graduationMonth: p.graduationMonth,
        },
      });
  }

  // Status, nationality, year of birth.
  if (p.sgStatus) {
    const withStatus = { sgStatus: p.sgStatus, status: p.status ?? null };
    if (a.sgStatus === null) {
      Object.assign(patch, withStatus);
      filled.add("status");
    } else if (a.sgStatus !== p.sgStatus)
      conflicts.push({
        id: "status",
        was: a.sgStatus,
        read: p.sgStatus,
        patch: {
          ...withStatus,
          ...(p.sgStatus === "citizen" ? { nationality: "SG" } : {}),
        },
      });
  } else if (p.status && a.status === null) {
    patch.status = p.status;
    filled.add("status");
  }
  if (p.nationality) {
    if (!a.nationality && !patch.nationality) {
      patch.nationality = p.nationality;
      filled.add("status");
    } else if (a.nationality && a.nationality !== p.nationality)
      conflicts.push({
        id: "nationality",
        was: a.nationality,
        read: p.nationality,
        patch: { nationality: p.nationality },
      });
  }
  if (p.birthYear) {
    if (!a.birthYear) {
      patch.birthYear = p.birthYear;
      filled.add("status");
    } else if (a.birthYear !== p.birthYear)
      conflicts.push({
        id: "birthYear",
        was: String(a.birthYear),
        read: String(p.birthYear),
        patch: { birthYear: p.birthYear },
      });
  }

  // The result, also as the finder's GPA on its scale (as /profile's grade fields write it).
  const grade: Partial<PlanAnswers> = {};
  let gradeFinder: Partial<FinderAnswers> = {};
  const degreeId = plannedDegree({ ...a, ...patch });
  if (p.degreeGpa != null) {
    const scale = defaultScale(degreeId ? university(degreeId) : null);
    Object.assign(grade, {
      degreeGpa: p.degreeGpa,
      averageMark: null,
      classification: null,
    });
    gradeFinder = {
      scale: scale === "uk" || scale === "100" ? "4.0" : scale,
      gpa: p.degreeGpa,
    };
  } else if (p.averageMark != null) {
    Object.assign(grade, {
      averageMark: p.averageMark,
      degreeGpa: null,
      classification: p.classification ?? null,
    });
    gradeFinder = { scale: "100", gpa: p.averageMark };
  } else if (p.classification) {
    Object.assign(grade, { classification: p.classification });
    gradeFinder = { scale: "uk", gpa: null };
  }
  if (Object.keys(grade).length) {
    const read = String(p.degreeGpa ?? p.averageMark ?? p.classification);
    const was = a.degreeGpa ?? a.averageMark ?? a.classification ?? f.gpa;
    if (!hasGrade(a)) {
      Object.assign(patch, grade);
      Object.assign(finder, gradeFinder);
      filled.add("grades");
    } else if (String(was) !== read)
      conflicts.push({
        id: "grade",
        was: String(was),
        read,
        patch: { ...grade, finder: { ...f, ...gradeFinder } },
      });
  }

  // English: the test, its score and when.
  if (p.englishTest) {
    const english = {
      englishTest: p.englishTest,
      englishScore: p.englishScore ?? null,
      englishTestMonth: p.englishTestMonth ?? null,
      englishTestYear: p.englishTestYear ?? null,
    };
    if (!hasEnglish(a) && !a.englishTest) {
      Object.assign(patch, english);
      filled.add("english");
    } else if (!hasEnglish(a) && a.englishTest === p.englishTest) {
      // The same test, half answered: the reading completes it.
      for (const [k, v] of Object.entries(english)) if (v !== null && a[k as keyof PlanAnswers] === null) Object.assign(patch, { [k]: v });
      filled.add("english");
    } else if (a.englishTest !== p.englishTest || (p.englishScore != null && a.englishScore !== p.englishScore))
      conflicts.push({
        id: "english",
        was: `${a.englishTest ?? ""} ${a.englishScore ?? ""}`.trim(),
        read: `${p.englishTest} ${p.englishScore ?? ""}`.trim(),
        patch: english,
      });
  }

  // The finder's own: directions, fee band, regions (only where none are chosen).
  const directions = reading.directions?.length ? reading.directions : directionsSaid(text);
  if (directions.length && !f.directions.length) {
    finder.directions = directions;
    filled.add("directions");
  }
  if (p.budget && !f.fee) {
    finder.fee = bandOf(p.budget);
    if (a.budget === null) patch.budget = p.budget;
    filled.add("budget");
  }
  if (p.countries?.length && !f.regions.length) {
    finder.regions = REGIONS.filter((r) => p.countries!.some((c) => r.has(c))).map((r) => r.id);
    if (!a.countries.length) patch.countries = p.countries;
    if (finder.regions.length) filled.add("budget");
  }
  if (Object.keys(finder).length) patch.finder = { ...f, ...finder };
  return { patch, filled: [...filled], conflicts };
}
