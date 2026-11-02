"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { CheckIcon, HistoryIcon, PlayIcon, SparklesIcon, UserIcon, UserRoundCheckIcon, XIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/workspace/spinner";
import type { PageContext } from "@/lib/agent/types";
import { MAX_TEXT, type IntakeResult } from "@/lib/adviser/types";
import { msg } from "@/lib/i18n/translate";
import { EMPTY_ANSWERS, type PlanAnswers } from "@/lib/plan-storage";
import { startPlanStore, usePlanStore } from "@/lib/workspace/plan-store";
import { cn } from "cn";
import { AuditBadge } from "./audit-badge";
import { DebateColumns } from "./debate-columns";
import { DecisionTable } from "./decision-table";
import { Feed } from "./feed";
import { Roadmap } from "./roadmap";
import { useAdviser, type Mode, type Phase } from "./use-adviser";

// /adviser, AI adviser v2 (docs/agent/debate-blueprint.md): 1 the student and at most two questions, 2 two advisers
// argue master's first and work first, 3 a judge decides (shown only once a second AI's audit passes), 4 the roadmap.
// Steps 3 and 4 never show before the audit passes; a run the audit blocks twice ends with a human adviser.

const PAGES: PageContext["page"][] = ["outcomes", "results", "careers", "plan", "profile", "algorithm", "parents", "adviser"];

const ERRORS: Record<string, string> = {
  busy: msg("Wait a minute and try again."),
  unavailable: msg("The AI adviser isn’t available right now."),
  "too-long": msg("That’s too long. Keep it under 800 characters."),
  missing: msg("The recorded run isn’t available."),
  timeout: msg("The adviser took too long. Try again."),
};

const ARJUN_TEXT = msg(
  "I'm Arjun from India, on a Student's Pass, finishing a Murdoch business top-up at Kaplan in December 2026. I want to work in fintech in Singapore. My parents want me to do a master's first; our budget is 400,000 CNY in total.",
);

/** Arjun's saved answers, as scripts/check-agent.ts sends them. */
const ARJUN_ANSWERS: PlanAnswers = {
  ...EMPTY_ANSWERS,
  level: "degree",
  programmeId: "murdoch-bachelor-of-business-in-finance",
  graduated: false,
  graduationMonth: 12,
  graduationYear: 2026,
  status: "student-pass",
  sgStatus: "student-pass",
  nationality: "IN",
  birthYear: 2004,
  degreeGpa: 3.2,
  englishTest: "ielts",
  englishScore: 6.5,
  englishTestMonth: 3,
  englishTestYear: 2026,
  finder: { background: "business", kind: "bachelor", gpa: 3.2, scale: "4.0", directions: ["finance"], fee: null, regions: [] },
};

const ORDER: Phase[] = ["idle", "intake", "asking", "debating", "judging", "auditing", "rewriting", "done"];
const reached = (phase: Phase, step: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(step) || phase === "human" || phase === "error";

function StepHead({ n, title, state }: { n: number; title: string; state: "todo" | "active" | "done" }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
          state === "done" && "border-primary bg-primary text-primary-foreground",
          state === "active" && "border-primary text-primary",
          state === "todo" && "text-muted-foreground",
        )}
      >
        {state === "done" ? <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden /> : state === "active" ? <Spinner className="size-3.5" /> : n}
      </span>
      <h2 className={cn("text-base font-semibold", state === "todo" && "text-muted-foreground")}>{title}</h2>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border bg-background p-4 sm:p-5">{children}</section>;
}

/** The intake's questions: option buttons, a free answer, and Continue. */
function Questions({ intake, onSend, disabled }: { intake: IntakeResult; onSend: (r: { id: string; answer: string }[]) => void; disabled: boolean }) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ready = intake.questions.every((q) => (answers[q.id] ?? "").trim());
  return (
    <div className="space-y-3">
      {intake.questions.map((q) => (
        <div key={q.id} className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3" role="group" aria-label={q.question}>
          <p className="mb-2 flex items-start gap-1.5 text-sm font-semibold">
            <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {q.question}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => (
              <Button key={o} size="sm" variant={answers[q.id] === o ? "default" : "outline"} disabled={disabled} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}>
                {o}
              </Button>
            ))}
          </div>
          <input
            className="mt-2 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={q.options.includes(answers[q.id] ?? "") ? "" : (answers[q.id] ?? "")}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder={t("Or type your answer")}
            aria-label={t("Your answer")}
          />
        </div>
      ))}
      <Button disabled={disabled || !ready} onClick={() => onSend(intake.questions.map((q) => ({ id: q.id, answer: (answers[q.id] ?? "").trim() })))}>
        {t("Continue")}
      </Button>
    </div>
  );
}

export function AdviserApp() {
  const t = useT();
  const locale = useLocale();
  const params = useSearchParams();
  const mode: Mode = params.get("replay") === "arjun" ? "replay" : params.get("mock") === "1" ? "mock" : "live";
  const fromParam = params.get("from") as PageContext["page"] | null;
  const from: PageContext["page"] = fromParam && PAGES.includes(fromParam) ? fromParam : "adviser";

  const { state, start, reply, reset } = useAdviser(mode);
  const saved = usePlanStore((s) => s.answers);
  const ready = usePlanStore((s) => s.ready);
  const [text, setText] = useState("");
  const [example, setExample] = useState(false);
  useEffect(() => startPlanStore(), []);

  const { phase } = state;
  const running = phase !== "idle" && phase !== "done" && phase !== "human" && phase !== "error" && phase !== "asking";
  const hasSaved = ready && (!!saved.programmeId || !!saved.sgStatus || !!saved.degreeGpa || !!saved.englishScore);

  const go = (body: string, useExample: boolean) => {
    if (!body.trim() || running) return;
    start({ text: body.trim(), answers: useExample ? ARJUN_ANSWERS : usePlanStore.getState().answers, locale, context: { page: from } });
  };
  const tryExample = () => {
    const body = t(ARJUN_TEXT);
    setText(body);
    setExample(true);
    go(body, true);
  };

  const passed = state.passed && !!state.final;
  const step2: "todo" | "active" | "done" = state.study.result || state.work.result ? (reached(phase, "judging") ? "done" : "active") : reached(phase, "debating") ? "active" : "todo";
  const step3: "todo" | "active" | "done" = passed ? "done" : reached(phase, "judging") && phase !== "error" && phase !== "human" ? "active" : "todo";

  return (
    <div className="space-y-4">
      {mode === "replay" && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-medium" role="note">
          <HistoryIcon className="size-4 shrink-0" aria-hidden />
          {t("This is a recorded real run")}
          {state.recordedAt && <span className="text-xs font-normal text-muted-foreground">{state.recordedAt}</span>}
        </p>
      )}
      {mode === "mock" && (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground" role="note">
          {t("Demo data: no AI is called.")}
        </p>
      )}

      <Section>
        <StepHead n={1} title={t("You")} state={phase === "idle" ? "todo" : phase === "intake" ? "active" : "done"} />
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(text, example);
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            maxLength={MAX_TEXT}
            rows={3}
            placeholder={t("Your degree, your grades, your budget, and the job you want")}
            aria-label={t("Tell the adviser about yourself")}
            disabled={running}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={running || !text.trim()}>
              {running ? <Spinner className="size-4" /> : <SparklesIcon aria-hidden />}
              {t("Ask the AI adviser")}
            </Button>
            {mode !== "replay" && (
              <Button type="button" variant="outline" disabled={running} onClick={tryExample}>
                <PlayIcon aria-hidden />
                {t("Try the Arjun example")}
              </Button>
            )}
            {mode === "replay" && (
              <Button type="button" variant="outline" disabled={running} onClick={tryExample}>
                <PlayIcon aria-hidden />
                {t("Play the recorded run")}
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {text.length}/{MAX_TEXT}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {example ? (
              <>
                <UserRoundCheckIcon className="size-3.5" aria-hidden />
                {t("Using Arjun’s example profile")}
                <button
                  type="button"
                  className="inline-flex items-center underline"
                  disabled={running}
                  onClick={() => {
                    setExample(false);
                    setText("");
                  }}
                >
                  <XIcon className="size-3" aria-hidden />
                  {t("Use mine")}
                </button>
              </>
            ) : (
              <>
                <UserIcon className="size-3.5" aria-hidden />
                {hasSaved ? t("Your saved answers are used too.") : t("No saved answers yet: the adviser reads only what you write.")}
                <Link href="/profile" className="underline">
                  {t("Edit")}
                </Link>
              </>
            )}
            {(phase === "done" || phase === "human" || phase === "error" || phase === "asking") && (
              <button type="button" className="ml-auto underline" onClick={reset}>
                {t("Start again")}
              </button>
            )}
          </p>
        </form>

        {phase === "intake" && <Feed items={state.intakeFeed} className="mt-3" />}
        {state.intake && (
          <div className="mt-3 space-y-3">
            {state.intake.goal && <p className="text-sm font-medium">{state.intake.goal}</p>}
            {!!state.intake.you.length && (
              <ul className="flex flex-wrap gap-1.5">
                {state.intake.you.map((c, i) => (
                  <li key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {c.text}
                  </li>
                ))}
              </ul>
            )}
            {phase === "asking" && !!state.intake.questions.length && <Questions intake={state.intake} onSend={reply} disabled={mode === "replay"} />}
          </div>
        )}
      </Section>

      {state.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          <p className="text-destructive">{t(ERRORS[state.error] ?? msg("That didn’t work. Try again."))}</p>
          {mode !== "replay" && (
            <Link href="/adviser?replay=arjun" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}>
              <HistoryIcon aria-hidden />
              {t("Watch the recorded run")}
            </Link>
          )}
        </div>
      )}

      {reached(phase, "debating") && phase !== "asking" && (state.study.feed.length > 0 || state.work.feed.length > 0 || state.study.result || state.work.result || phase === "debating" || state.study.failed || state.work.failed) && (
        <Section>
          <StepHead n={2} title={t("Two advisers argue it out")} state={step2} />
          <DebateColumns study={state.study} work={state.work} running={phase === "debating"} />
        </Section>
      )}

      {(reached(phase, "judging") && (state.final || state.judgeFeed.length > 0 || phase === "judging")) && (
        <Section>
          <StepHead n={3} title={t("The decision")} state={step3} />
          {!passed && (phase === "judging" || phase === "rewriting") && <Feed items={state.judgeFeed} className="mb-3" />}
          <AuditBadge phase={phase} checking={state.checking} checked={passed ? (state.audit?.verdicts.length ?? state.checking) : null} blocked={state.blocked} />
          {passed && state.final && (
            <div className="mt-3">
              <DecisionTable final={state.final} />
            </div>
          )}
          {phase === "human" && (
            <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
              <p className="mb-2 font-medium text-destructive">{t("This advice didn’t pass the check — please talk to a human adviser.")}</p>
              <Link href="/careers" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                {t("Careers")}
              </Link>
            </div>
          )}
        </Section>
      )}

      {passed && state.final && (
        <Section>
          <StepHead n={4} title={t("Your roadmap")} state="done" />
          <Roadmap final={state.final} />
        </Section>
      )}
    </div>
  );
}
