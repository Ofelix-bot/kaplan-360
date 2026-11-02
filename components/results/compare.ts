import { LEVEL_NAME, standing } from "@/lib/admit-range";
import { englishWaiver, needsScore } from "@/lib/english-rule";
import type { EnglishTest, PlanAnswers } from "@/lib/plan-storage";
import { conversionNote, RANK_NAME, studentRank } from "@/lib/grades";
import { makeT, type T } from "@/lib/i18n/translate";
import type { ResultsProgramme } from "@/lib/results-types";

// Each check puts one of the student's answers next to the programme's published minimum. It never
// adds up to a verdict: "meets" means the published minimum, not an offer; "unknown" means the page
// doesn't state it in a comparable way, and the student checks the official wording.

/** `need` and `you` are the short forms shown in a result card's pills; `text` is the full sentence. */
export type Check = { label: string; state: "meets" | "below" | "unknown" | "info"; text: string; need: string; you?: string };

const TEST_NAME: Record<Exclude<EnglishTest, "none">, string> = { ielts: "IELTS", toefl: "TOEFL iBT", pte: "PTE Academic", duolingo: "Duolingo" };

const ENGLISH = makeT({});

/** A grade as words in the page's language: "average 66%", "GPA 3.2/4.2", "2:1". */
export const basisText = (t: T, b: string) => {
  const more = /^average (\d+)% or more$/.exec(b);
  if (more) return t("average {n}% or more", { n: more[1] });
  const below = /^average below (\d+)%$/.exec(b);
  if (below) return t("average below {n}%", { n: below[1] });
  return /^average /.test(b) ? t("average {mark}", { mark: b.slice(8) }) : /^GPA /.test(b) ? b : t(b);
};

/**
 * `university` is the partner university awarding the student's Kaplan degree: its grading scheme
 * turns their result into a UK class (lib/grades.ts), as the programme's requirement is; `awardedIn` is its
 * country, for English waivers (lib/english-rule.ts). `label` stays in English (it keys the pill); `text`,
 * `need` and `you` are in the page's language.
 */
export function checks(p: ResultsProgramme, a: PlanAnswers, university: string | null, t: T = ENGLISH, awardedIn: string | null = null): Check[] {
  const out: Check[] = [];

  // Degree result: both sides on the UK class scale, each converted from its own system, and placed on
  // the programme's admission range (a high 2:1 minimum is met by a 2:1 only at 65% or more).
  if (p.minClass) {
    const need = t(p.range.floor !== null ? LEVEL_NAME[p.range.floor] : RANK_NAME[p.minClass]);
    const wording = p.minBasis !== null && p.minBasis !== RANK_NAME[p.minClass] && p.minBasis !== "High 2:1";
    const asked =
      p.minBasis === "good degree"
        ? t("a good degree (read as a {grade})", { grade: need })
        : p.minBasis === "strong degree"
          ? t("a strong degree (read as a {grade})", { grade: need })
          : wording
            ? `${basisText(t, p.minBasis!)} (≈ ${need})`
            : t("a {grade}", { grade: need });
    const you = studentRank(university, a);
    if (!you) out.push({ label: "Degree", state: "info", text: t("Asks for {asked} or equivalent", { asked }), need: `${need}+` });
    else {
      const s = standing(p.range, you);
      const plain = you.basis === RANK_NAME[you.rank];
      const converted = !plain || wording;
      const mine = plain ? t("you expect a {grade}", { grade: t(you.basis) }) : t("you ≈ {grade} ({basis})", { grade: t(RANK_NAME[you.rank]), basis: basisText(t, you.basis) });
      out.push({
        label: "Degree",
        state: s === "below" ? "below" : s === "edge" ? "info" : "meets",
        text:
          `${t("Asks for {asked}", { asked })} · ${mine}` +
          (s === "edge" ? ` · ${t("met only at {n}% or more", { n: p.range.floor ?? 0 })}` : "") +
          (converted ? ` · ${t("converted with each university’s published grade bands, approximate ({note})", { note: conversionNote(university, p.minBasis, t) })}` : ""),
        need: `${need}+`,
        you: plain ? t(you.basis) : `≈${t(RANK_NAME[you.rank])}`,
      });
    }
  } else if (p.academic) out.push({ label: "Degree", state: "unknown", text: t("Stated in the university’s own words, not as a class or grade"), need: t("see wording") });

  // English: a waiver for a degree taught in English first (it applies whatever the student's score), then the
  // student's own test.
  const minimum = [p.ielts !== null && `IELTS ${p.ielts}`, p.toefl !== null && `TOEFL iBT ${p.toefl}`].filter(Boolean).join(" / ");
  const waiver = englishWaiver(p.englishRule, awardedIn);
  const quote = p.englishRule?.exemption?.quote ?? "";
  if (waiver === "yes")
    out.push({
      label: "English",
      state: "meets",
      text: t("No test needed with a degree taught in English (ask for a letter confirming it): “{quote}”", { quote }) + (minimum ? ` · ${t("otherwise {minimum}", { minimum })}` : ""),
      need: t("English-taught degree"),
    });
  else if (waiver === "maybe")
    out.push({
      label: "English",
      state: "info",
      text: t("Waiver unconfirmed: the waiver names your degree’s country, but your degree was studied in Singapore; ask the university whether it counts: “{quote}”", { quote }) + (minimum ? ` · ${t("otherwise {minimum}", { minimum })}` : ""),
      need: t("waiver unconfirmed"),
    });
  else if (p.englishRule?.exemption)
    out.push({
      label: "English",
      state: a.englishTest && a.englishTest !== "none" && a.englishScore !== null && p[a.englishTest] !== null ? (a.englishScore >= p[a.englishTest]! ? "meets" : "below") : "info",
      text: t("A score is needed: the waiver doesn’t cover a degree studied in Singapore: “{quote}”", { quote }) + (minimum ? ` · ${minimum}` : ""),
      need: minimum || t("score needed"),
      you: a.englishScore !== null ? String(a.englishScore) : undefined,
    });
  else if (a.englishTest === "none" || (a.englishTest && a.englishScore === null && needsScore(p, awardedIn)))
    out.push({ label: "English", state: needsScore(p, awardedIn) ? "below" : "info", text: needsScore(p, awardedIn) ? t("A score is needed{minimum}", { minimum: minimum ? `: ${minimum}` : "" }) : t("No English minimum on the page"), need: minimum || t("not stated"), you: t("none yet") });
  else if (a.englishTest) {
    const need = p[a.englishTest];
    const short = TEST_NAME[a.englishTest];
    const name = p.englishUniversityWide ? t("{test} (university-wide minimum)", { test: short }) : short;
    if (need === null)
      out.push({
        label: "English",
        state: "unknown",
        text: p.ielts ? t("No {test} score on the page (IELTS {ielts})", { test: name, ielts: p.ielts }) : t("No {test} score on the page", { test: name }),
        need: t("{test} not stated", { test: short }),
      });
    else if (a.englishScore === null) out.push({ label: "English", state: "info", text: t("{test} {score} overall", { test: name, score: need }), need: `${short} ${need}` });
    else
      out.push({
        label: "English",
        state: a.englishScore >= need ? "meets" : "below",
        text: `${name} ${need} · ${t("you {value}", { value: a.englishScore })}`,
        need: `${short} ${need}`,
        you: String(a.englishScore),
      });
  } else if (p.ielts) out.push({ label: "English", state: "info", text: t("{test} {score} overall", { test: "IELTS", score: p.ielts }), need: `IELTS ${p.ielts}` });

  // GRE / GMAT: only when the page asks for one.
  for (const [k, name] of [["gre", "GRE"], ["gmat", "GMAT"]] as const) {
    const req = p[k];
    if (!req || req.status !== "required") continue;
    const mine = a[k];
    if (mine === null && a.greGmat === "have") out.push({ label: name, state: "info", text: t("{test} required · you have a GRE or GMAT score", { test: name }), need: t("required") });
    else if (mine === null) out.push({ label: name, state: "below", text: t("{test} required · you haven’t added a score", { test: name }), need: t("required"), you: t("none") });
    else if (req.min) out.push({ label: name, state: mine >= req.min ? "meets" : "below", text: `${name} ${req.min} · ${t("you {value}", { value: mine })}`, need: String(req.min), you: String(mine) });
    else out.push({ label: name, state: "info", text: t("{test} required · you have a score", { test: name }), need: t("required"), you: String(mine) });
  }

  // Work experience: only when the requirement asks for years of it.
  if (p.work) {
    const years = t(p.work === 1 ? "1 year" : "{n} years", { n: p.work });
    const asked = t("Asks for {years} of work experience", { years });
    if (a.workExperience === "none") out.push({ label: "Work experience", state: "below", text: `${asked} · ${t("you have none yet")}`, need: years, you: t("none") });
    else out.push({ label: "Work experience", state: "info", text: asked, need: years });
  }
  return out;
}
