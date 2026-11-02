"use client";

import { useId, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { monthName, monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { MAX_SENTENCE, type ProfilePatch, type ProfileReading } from "@/lib/profile-reading";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";

// The one-sentence shortcut: the student describes themselves in one sentence, the server reads it into the
// form's fields (app/api/profile), and nothing is saved until the student has checked what was read
// and pressed "Use these answers". Only the sentence is sent.

const STATUS = { "student-pass": "Student’s Pass", "citizen-pr": "Citizen or PR", "other-pass": "Another pass" } as const;
const TEST = { ielts: "IELTS", toefl: "TOEFL iBT", pte: "PTE Academic", duolingo: "Duolingo", none: "" } as const;
const CLASS = { first: "First", "2:1": "2:1", "2:2": "2:2", third: "Third", unsure: "" } as const;
const INTAKE = { "jan-mar": "Jan – Mar", "jul-oct": "Jul – Oct", any: "Any time" } as const;
const ERRORS: Record<string, string> = {
  unavailable: msg("This shortcut isn’t available right now. Fill in the form below."),
  busy: msg("Too many tries in a row. Wait a minute, or fill in the form below."),
  "too-long": msg("Keep it to {n} characters."),
  failed: msg("That didn’t work. Try again, or fill in the form below."),
};

type Phase = "idle" | "reading" | "read" | "applied";

export default function ProfileSentence({
  programmes,
  disciplines,
  schools,
  onApply,
  placeholder,
  examples = [],
  inForm = true,
}: {
  programmes: KaplanProgrammeOption[];
  disciplines: Record<string, string>;
  schools: SchoolOption[];
  /** `field`: the Kaplan field the sentence named when it named no single programme. */
  onApply: (patch: ProfilePatch, field: string | null) => void;
  placeholder?: string;
  /** Sentences to start from, each behind a short label. */
  examples?: { label: string; text: string }[];
  /** Inside step 1's form (a "Continue" button submits it), or on its own (the results page's filters). */
  inForm?: boolean;
}) {
  const t = useT();
  const names = useSiteNames();
  const locale = useIntlLocale();
  const id = useId();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reading, setReading] = useState<ProfileReading | null>(null);
  const [error, setError] = useState("");

  const read = async () => {
    if (!text.trim() || phase === "reading") return;
    setPhase("reading");
    setError("");
    try {
      const r = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
      const body = (await r.json().catch(() => ({}))) as Partial<ProfileReading> & { error?: string };
      if (!r.ok || !body.patch) throw new Error(body.error ?? "failed");
      setReading(body as ProfileReading);
      setPhase("read");
    } catch (e) {
      setError(t(ERRORS[(e as Error).message] ?? ERRORS.failed, { n: MAX_SENTENCE }));
      setPhase("idle");
    }
  };

  const p = reading?.patch ?? {};
  // S$ spelled out (a bare "$" reads as US dollars); other currencies in the page's own format.
  const money = (amount: number, currency: string) =>
    currency === "SGD" ? `S$${amount.toLocaleString(locale)}` : new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  const programme = programmes.find((x) => x.id === p.programmeId);
  const school = schools.find((s) => s.id === p.school);
  const field = p.schoolDiscipline ?? reading?.field ?? null;
  const rows: [string, string][] = [];
  if (p.level || programme || school) {
    const level = p.level === "diploma" ? t("Diploma") : p.level === "degree" ? t("Bachelor’s degree") : "";
    rows.push([t("Studying now"), [level, programme ? names.degree(programme.name).name : school && names.school(school.name).name].filter(Boolean).join(" · ")]);
  }
  if (field && !programme)
    rows.push([
      t("Field"),
      school
        ? t(disciplines[field])
        : t(inForm ? "{field}: choose your programme below" : "{field}: choose your Kaplan degree in Quick filter", { field: t(disciplines[field]) }),
    ]);
  if (p.graduationYear || p.graduationMonth)
    rows.push([
      t("You graduate"),
      p.graduationYear && p.graduationMonth ? monthYear(locale, p.graduationYear * 12 + p.graduationMonth - 1) : p.graduationYear ? String(p.graduationYear) : monthName(locale, p.graduationMonth! - 1, "long"),
    ]);
  if (p.status) rows.push([t("Status in Singapore"), t(STATUS[p.status])]);
  if (p.englishTest) rows.push([t("English test"), [TEST[p.englishTest], p.englishScore].filter((x) => x !== undefined && x !== "").join(" ")]);
  const result = [p.averageMark != null ? t("Average {n}%", { n: p.averageMark }) : null, p.degreeGpa != null ? `GPA ${p.degreeGpa}` : null, p.classification ? t(CLASS[p.classification]) : null].filter(Boolean);
  if (result.length) rows.push([t("Expected degree result"), result.join(" · ")]);
  if (p.countries?.length) rows.push([t("Countries"), p.countries.map((c) => t(c)).join(locale.startsWith("zh") ? "、" : ", ")]);
  if (p.intake) rows.push([t("Start"), t(INTAKE[p.intake])]);
  if (p.budget)
    rows.push([
      t("Tuition budget"),
      `${t("Up to {amount} a year", { amount: money(p.budget, "SGD") })}${reading?.budgetFrom ? ` (${t("from {amount}, at MAS rates", { amount: money(reading.budgetFrom.amount, reading.budgetFrom.currency) })})` : ""}`,
    ]);

  return (
    <div className="plan-sentence">
      <label className="field-label" htmlFor={`${id}-text`}>
        {t("Describe yourself in one sentence")}
      </label>
      <p className="field-hint" id={`${id}-hint`}>
        {t("We’ll fill in the form for you. Only this sentence is sent, and it isn’t stored.")}
      </p>
      <textarea
        id={`${id}-text`}
        className="textarea"
        rows={3}
        maxLength={MAX_SENTENCE}
        value={text}
        placeholder={placeholder ?? t("e.g. I’m on Kaplan’s business management diploma, finishing in June next year, IELTS 6.5, Student’s Pass, thinking of the UK or Australia, up to S$40,000 a year")}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setText(e.target.value);
          if (phase === "applied") setPhase("idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            read();
          }
        }}
      />
      {examples.length > 0 && (
        <div className="plan-sentence-examples" role="group" aria-label={t("Examples")}>
          {examples.map((x) => (
            <button key={x.label} type="button" className="chip" onClick={() => (setText(x.text), setPhase("idle"))}>
              {x.label}
            </button>
          ))}
        </div>
      )}
      <div className="plan-sentence-actions">
        <button type="button" className="button button-quiet" onClick={read} disabled={!text.trim() || phase === "reading"} aria-busy={phase === "reading"}>
          {phase === "reading" ? t("Reading…") : t("Fill in the form for me")}
        </button>
        <span className="plan-sentence-count" aria-hidden="true">
          {text.length}/{MAX_SENTENCE}
        </span>
      </div>
      <div role="status" aria-live="polite" className="plan-sentence-live">
        {error && <p className="field-error">{error}</p>}
        {phase === "read" && reading && (
          <div className="plan-sentence-read">
            {rows.length ? (
              <>
                <p className="plan-sentence-title">{t("Is this right?")}</p>
                <dl>
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="plan-sentence-actions">
                  <button
                    type="button"
                    className="button button-solid"
                    onClick={() => {
                      onApply(reading.patch, reading.field);
                      setPhase("applied");
                    }}
                  >
                    {t("Use these answers")}
                  </button>
                  <button type="button" className="button button-quiet" onClick={() => setPhase("idle")}>
                    {t("Not quite: change my sentence")}
                  </button>
                </div>
              </>
            ) : (
              <p>{t("We couldn’t find any answers in that. Try saying what you study, when you finish and your English score.")}</p>
            )}
          </div>
        )}
        {phase === "applied" && !inForm && <p className="plan-sentence-done">{t("Filled in: your answers are set in the filters.")}</p>}
        {phase === "applied" && inForm && (
          <div className="plan-sentence-done">
            <p>{t("Filled in. Check the form below, add anything missing, then continue.")}</p>
            {/* Submits step 1's form: its own checks still run and point to anything missing. */}
            <button type="submit" className="button button-solid">
              {t("Continue")} <span className="arrow" aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
