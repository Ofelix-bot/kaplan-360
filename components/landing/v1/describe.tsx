"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, WandSparklesIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useIntlLocale, useLocalize, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { monthName, monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { transitions } from "@/lib/motion";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import { closeExample, EMPTY_ANSWERS, getPlanSnapshot, parsePlan, savePlan } from "@/lib/plan-storage";
import { MAX_SENTENCE, withSentence, type ProfileReading } from "@/lib/profile-reading";

// The one-sentence start on the homepage: the student describes themselves, the server reads the
// sentence into Start planning's answers (app/api/profile), and nothing is kept until they have
// checked what was read and pressed "Use these answers"; then Programmes for you opens, filled in.
// While the sentence is being read, the answers' rows show as placeholders. Only the sentence is sent.

const STATUS = { "student-pass": "Student’s Pass", "citizen-pr": "Citizen or PR", "other-pass": "Another pass" } as const;
const TEST = { ielts: "IELTS", toefl: "TOEFL iBT", pte: "PTE Academic", duolingo: "Duolingo", none: "" } as const;
const CLASS = { first: "First", "2:1": "2:1", "2:2": "2:2", third: "Third", unsure: "" } as const;
const INTAKE = { "jan-mar": "Jan – Mar", "jul-oct": "Jul – Oct", any: "Any time" } as const;
const ERRORS: Record<string, string> = {
  unavailable: msg("This shortcut isn’t available right now. Use Start planning instead."),
  busy: msg("Too many tries in a row. Wait a minute, or use Start planning."),
  "too-long": msg("Keep it to {n} characters."),
  failed: msg("That didn’t work. Try again, or use Start planning."),
};

type Phase = "idle" | "reading" | "read";

export function Describe({ programmes, disciplines, schools }: { programmes: KaplanProgrammeOption[]; disciplines: Record<string, string>; schools: SchoolOption[] }) {
  const t = useT();
  const names = useSiteNames();
  const locale = useIntlLocale();
  const router = useRouter();
  const localize = useLocalize();
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
  if (field && !programme && disciplines[field]) rows.push([t("Field"), t(disciplines[field])]);
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
  if (p.budget) rows.push([t("Tuition budget"), t("Up to {amount} a year", { amount: money(p.budget, "SGD") })]);

  const apply = () => {
    if (!reading) return;
    closeExample();
    const stored = parsePlan(getPlanSnapshot());
    savePlan(withSentence(stored?.answers ?? EMPTY_ANSWERS, reading.patch), stored?.remember ?? true);
    router.push(localize("/results"));
  };

  return (
    <div className="flex flex-col gap-3 text-foreground">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-text`} className="text-sm font-semibold">
          {t("Describe yourself in one sentence")}
        </label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t("We’ll fill in the form for you. Only this sentence is sent, and it isn’t stored.")}
        </p>
      </div>
      <Textarea
        id={`${id}-text`}
        rows={3}
        maxLength={MAX_SENTENCE}
        value={text}
        placeholder={t("e.g. Murdoch accounting degree at Kaplan, expecting a 72% average, IELTS 6.5, Hong Kong or Singapore, up to S$45,000 a year")}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void read();
          }
        }}
        className="bg-background"
      />
      <div className="flex items-center gap-2">
        <Button onClick={() => void read()} disabled={!text.trim() || phase === "reading"} aria-busy={phase === "reading"}>
          <WandSparklesIcon />
          {phase === "reading" ? t("Reading…") : t("Fill in the form for me")}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-hidden>
          {text.length}/{MAX_SENTENCE}
        </span>
      </div>
      <div role="status" aria-live="polite">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AnimatePresence initial={false} mode="wait">
          {phase === "reading" && (
            <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: transitions.exit }} className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
              <span className="sr-only">{t("Reading…")}</span>
              {[0.55, 0.4, 0.62, 0.35].map((w, i) => (
                <div key={i} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4" style={{ width: `${w * 100}%` }} />
                </div>
              ))}
            </motion.div>
          )}
          {phase === "read" && reading && (
            <motion.div key="read" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: transitions.exit }} transition={transitions.enter} className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
              {rows.length ? (
                <>
                  <p className="text-sm font-medium">{t("Is this right?")}</p>
                  <dl className="flex flex-col gap-1.5">
                    {rows.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={apply}>
                      <CheckIcon />
                      {t("Use these answers")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPhase("idle")}>
                      {t("Not quite: change my sentence")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm">{t("We couldn’t find any answers in that. Try saying what you study, when you finish and your English score.")}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
