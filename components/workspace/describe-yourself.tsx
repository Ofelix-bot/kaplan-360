"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, WandSparklesIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { monthName, monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { transitions } from "@/lib/motion";
import { MAX_SENTENCE, withSentence, type ProfileReading } from "@/lib/profile-reading";
import { useWorkspace } from "@/lib/workspace/store";
import { useModel } from "./model";
import { Spinner } from "./spinner";

// The one-sentence shortcut on /results: the student describes themselves in one sentence, the server
// reads it into the filters' fields (app/api/profile), and nothing changes until the student has
// checked what was read and pressed "Use these answers". Only the sentence is sent, and it isn't kept.

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

export function DescribeYourself({ onDone }: { onDone: () => void }) {
  const t = useT();
  const names = useSiteNames();
  const locale = useIntlLocale();
  const id = useId();
  const { programmes, disciplines, schools, answers, update } = useModel();
  const setScope = useWorkspace((s) => s.setScope);
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  // Opened from the homepage's "I have an idea": the cursor is already in the box.
  const askFocus = useWorkspace((s) => s.askFocus);
  useEffect(() => {
    if (!askFocus) return;
    // The caller has already scrolled the workspace into view; a focus scroll would overshoot it.
    box.current?.focus({ preventScroll: true });
    useWorkspace.getState().setAskFocus(false);
  }, [askFocus]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [reading, setReading] = useState<ProfileReading | null>(null);
  const [error, setError] = useState("");
  const examples = [
    { label: t("Accounting, Hong Kong or Singapore"), text: t("Murdoch accounting degree at Kaplan, expecting a 72% average, IELTS 6.5, Hong Kong or Singapore, up to S$45,000 a year") },
    { label: t("Business analytics, UK or Ireland"), text: t("UCD business analytics top-up at Kaplan, expecting a 2:1, IELTS 7, the UK or Ireland, starting in September") },
    { label: "心理学，澳洲，4 万新币", text: "我在 Kaplan 读 Murdoch 的心理学本科，雅思 7，想去澳洲读研，每年预算 4 万新币" },
  ];

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
  if (field && !programme) rows.push([t("Field"), school ? t(disciplines[field]) : t("{field}: choose your Kaplan degree in Quick filter", { field: t(disciplines[field]) })]);
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
  if (p.budget) rows.push([t("Tuition budget"), `${t("Up to {amount} a year", { amount: money(p.budget, "SGD") })}${reading?.budgetFrom ? ` (${t("from {amount}, at MAS rates", { amount: money(reading.budgetFrom.amount, reading.budgetFrom.currency) })})` : ""}`]);

  const apply = () => {
    if (!reading) return;
    update(withSentence(answers, reading.patch));
    // A field named without a single programme still narrows the list.
    setScope({ fieldChoice: !reading.patch.programmeId && reading.field ? reading.field : null });
    setPhase("applied");
    onDone();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-text`} className="text-sm font-medium">
          {t("Describe yourself in one sentence")}
        </label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t("We’ll fill in the form for you. Only this sentence is sent, and it isn’t stored.")}
        </p>
      </div>
      <Textarea
        ref={box}
        id={`${id}-text`}
        rows={4}
        maxLength={MAX_SENTENCE}
        value={text}
        placeholder={t("e.g. Murdoch accounting degree at Kaplan, expecting a 72% average, IELTS 6.5, Hong Kong or Singapore, up to S$45,000 a year")}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setText(e.target.value);
          if (phase === "applied") setPhase("idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void read();
          }
        }}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Examples")}>
        {examples.map((x) => (
          <Button key={x.label} variant="outline" size="xs" className="rounded-full px-2.5" onClick={() => (setText(x.text), setPhase("idle"))}>
            {x.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void read()} disabled={!text.trim() || phase === "reading"} aria-busy={phase === "reading"}>
          {phase === "reading" ? <Spinner className="size-4" /> : <WandSparklesIcon />}
          {phase === "reading" ? t("Reading…") : t("Fill in the form for me")}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-hidden>
          {text.length}/{MAX_SENTENCE}
        </span>
      </div>
      <div role="status" aria-live="polite">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AnimatePresence initial={false}>
          {phase === "read" && reading && (
            <motion.div key="read" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: transitions.exit }} transition={transitions.enter} className="flex flex-col gap-3 rounded-xl border bg-(--rs-raised) p-3">
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
        {phase === "applied" && <p className="text-sm text-muted-foreground">{t("Filled in: your answers are set in the filters.")}</p>}
      </div>
    </div>
  );
}
