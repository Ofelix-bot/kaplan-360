"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { GraduationCapIcon, HistoryIcon, PlayIcon, SparklesIcon, UserIcon, UserRoundCheckIcon, XIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PageContext } from "@/lib/agent/types";
import { MAX_TEXT, type IntakeResult } from "@/lib/adviser/types";
import { msg } from "@/lib/i18n/translate";
import { EMPTY_ANSWERS, type PlanAnswers } from "@/lib/plan-storage";
import { startPlanStore, usePlanStore } from "@/lib/workspace/plan-store";
import { cn } from "cn";
import s from "./adviser.module.css";
import { useAdviserKappy } from "./adviser-kappy";
import { AuditBadge } from "./audit-badge";
import { DebateColumns } from "./debate-columns";
import { DecisionTable } from "./decision-table";
import { Blink, Feed } from "./feed";
import { Roadmap } from "./roadmap";
import { useAdviser, type AdviserState, type Mode, type Phase } from "./use-adviser";

// /adviser, AI adviser v2 (docs/agent/debate-blueprint.md): 1 the student and at most two questions, 2 two advisers
// argue master's first and work first, 3 a judge decides (shown only once a second AI's audit passes), 4 the roadmap:
// three plans the student chooses between, read and highlighted by Kappy (docs/agent/roadmap.md). Steps 3 and 4 never
// show before the audit passes; a run the audit blocks twice ends with a human adviser. Laid out in Kappy's design
// language (adviser.module.css): one plate, Kappy's head with the five steps on top, and the four steps below, each
// shown from the start with what it waits for.

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

// Two real runs of the Arjun example, recorded ahead with scripts/check-adviser.ts (RECORD=…): the example plays one
// at once instead of waiting minutes for the model. The student's own words always go to the model.
const RUNS = ["/adviser/arjun-recorded.json", "/adviser/arjun-recorded-2.json"] as const;

const ORDER: Phase[] = ["idle", "intake", "asking", "debating", "judging", "auditing", "rewriting", "planning", "reviewing", "done"];
const reached = (phase: Phase, step: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(step) || phase === "human" || phase === "error";

type StepState = "todo" | "active" | "done" | "blocked";

/** The five steps in Kappy's head: Profile, Analysis, Decide, Check, Roadmap. */
function stepStates(state: AdviserState): StepState[] {
  const { phase, passed } = state;
  const at = (...p: Phase[]) => p.includes(phase);
  const settled = at("debating", "judging", "auditing", "rewriting", "planning", "reviewing", "done", "human", "error");
  return [
    at("intake", "asking") ? "active" : state.intake && settled ? "done" : "todo",
    at("debating") ? "active" : (state.study.result || state.work.result) && !at("idle", "intake", "asking") ? "done" : "todo",
    at("judging") ? "active" : state.final && (reached(phase, "auditing") || at("human")) ? "done" : "todo",
    at("auditing", "rewriting") ? "active" : passed ? "done" : at("human") ? "blocked" : "todo",
    at("planning", "reviewing") ? "active" : at("done") && passed && state.plans ? "done" : "todo",
  ];
}

const STEPS = [msg("Profile"), msg("Analysis"), msg("Decide"), msg("Check"), msg("Roadmap")];

function Steps({ states, compact }: { states: StepState[]; compact: boolean }) {
  const t = useT();
  return (
    <ol className={s.pills} aria-label={compact ? undefined : t("Progress")}>
      {STEPS.map((name, i) => (
        <li key={name} data-s={states[i] === "todo" ? undefined : states[i]} aria-current={states[i] === "active" ? "step" : undefined}>
          <i>{i + 1}</i>
          <span className={s.pillName}>{t(name)}</span>
        </li>
      ))}
    </ol>
  );
}

function Panel({ n, title, state, wait, children }: { n: number; title: string; state: "todo" | "active" | "done"; wait?: string | false; children?: ReactNode }) {
  const t = useT();
  return (
    <section className={s.panel} aria-labelledby={`step-${n}`}>
      <div className={s.panelH} data-s={state}>
        <span className={s.num}>{t("Step {n}", { n })}</span>
        <h2 id={`step-${n}`}>{title}</h2>
        {state === "active" && <Blink />}
        {wait && <span className={s.wait}>{wait}</span>}
      </div>
      {children}
    </section>
  );
}

/** The intake's questions: option buttons, a free answer, and Continue. */
function Questions({ intake, onSend, disabled }: { intake: IntakeResult; onSend: (r: { id: string; answer: string }[]) => void; disabled: boolean }) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ready = intake.questions.every((q) => (answers[q.id] ?? "").trim());
  return (
    <div className="grid gap-3">
      {intake.questions.map((q) => (
        <div key={q.id} className={s.ask} role="group" aria-label={q.question}>
          <p>{q.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => (
              <Button key={o} size="sm" variant={answers[q.id] === o ? "default" : "outline"} disabled={disabled} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}>
                {o}
              </Button>
            ))}
          </div>
          <input
            className={s.askInput}
            value={q.options.includes(answers[q.id] ?? "") ? "" : (answers[q.id] ?? "")}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder={t("Or type your answer")}
            aria-label={t("Your answer")}
          />
        </div>
      ))}
      <Button className={cn(s.primary, "justify-self-start")} disabled={disabled || !ready} onClick={() => onSend(intake.questions.map((q) => ({ id: q.id, answer: (answers[q.id] ?? "").trim() })))}>
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

  const { state, start, reply, reset, retry } = useAdviser(mode);
  const kappy = useAdviserKappy(state);
  const saved = usePlanStore((s) => s.answers);
  const ready = usePlanStore((s) => s.ready);
  // A question spoken to the corner Kappy arrives as ?q= (components/kappy/KappyDock.tsx).
  const [text, setText] = useState(() => (params.get("q") ?? "").slice(0, MAX_TEXT));
  const [example, setExample] = useState(false);
  const [runNo, setRunNo] = useState(0);
  useEffect(() => startPlanStore(), []);

  const { phase } = state;
  const running = phase !== "idle" && phase !== "done" && phase !== "human" && phase !== "error" && phase !== "asking";
  const hasSaved = ready && (!!saved.programmeId || !!saved.sgStatus || !!saved.degreeGpa || !!saved.englishScore);

  const go = (body: string, useExample: boolean, recording: string | null = null) => {
    if (!body.trim() || running) return;
    start({ text: body.trim(), answers: useExample ? ARJUN_ANSWERS : usePlanStore.getState().answers, locale, context: { page: from } }, recording);
  };
  const tryExample = (n = runNo) => {
    const body = t(ARJUN_TEXT);
    setRunNo(n);
    setText(body);
    setExample(true);
    // The demo page plays a recorded run; ?replay=arjun and ?mock=1 keep their own sources.
    go(body, true, mode === "live" ? RUNS[n] : null);
  };

  const passed = state.passed && !!state.final;
  const steps = stepStates(state);
  const step1: "todo" | "active" | "done" = phase === "idle" ? "todo" : phase === "intake" || phase === "asking" ? "active" : "done";
  const step2: "todo" | "active" | "done" = state.study.result || state.work.result ? (reached(phase, "judging") ? "done" : "active") : reached(phase, "debating") ? "active" : "todo";
  const step3: "todo" | "active" | "done" = passed ? "done" : reached(phase, "judging") && phase !== "error" && phase !== "human" ? "active" : "todo";
  const step4: "todo" | "active" | "done" = phase === "planning" || phase === "reviewing" ? "active" : state.plans ? "done" : "todo";
  const showDebate =
    reached(phase, "debating") &&
    phase !== "asking" &&
    (state.study.feed.length > 0 || state.work.feed.length > 0 || state.study.result || state.work.result || phase === "debating" || state.study.failed || state.work.failed);
  const showDecision = reached(phase, "judging") && (state.final || state.judgeFeed.length > 0 || phase === "judging");

  return (
    <div>
      {mode === "replay" && (
        <p className={s.note} role="note">
          <HistoryIcon className="size-4 shrink-0 self-center" aria-hidden />
          <b>{t("This is a recorded real run")}</b>
          {state.recordedAt && <span className={s.muted}>{state.recordedAt}</span>}
        </p>
      )}
      {mode === "mock" && (
        <p className={s.note} role="note">
          <b>{t("Demo data: no AI is called.")}</b>
        </p>
      )}

      <div className={s.plate}>
        {kappy.head(
          (compact) => <Steps states={steps} compact={compact} />,
          { value: text, onText: setText, disabled: running },
        )}

        <Panel n={1} title={t("You")} state={step1}>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go(text, example, example && mode === "live" && text === t(ARJUN_TEXT) ? RUNS[runNo] : null);
            }}
          >
            <Textarea
              className={s.said}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX_TEXT));
                kappy.hear(e.target);
              }}
              maxLength={MAX_TEXT}
              rows={3}
              placeholder={t("Your degree, your grades, your budget, and the job you want")}
              aria-label={t("Tell the adviser about yourself")}
              disabled={running}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" className={s.primary} disabled={running || !text.trim()}>
                {running ? <Blink /> : <SparklesIcon aria-hidden />}
                {t("Ask the AI adviser")}
              </Button>
              <Button type="button" variant="outline" disabled={running} onClick={() => tryExample()}>
                <PlayIcon aria-hidden />
                {mode === "replay" ? t("Play the recorded run") : t("Try the Arjun example")}
              </Button>
              {mode === "live" && (
                <span className={s.runs} role="group" aria-label={t("Example run")}>
                  {RUNS.map((_, n) => (
                    <button key={n} type="button" aria-pressed={runNo === n} aria-label={t("Example run {n}", { n: n + 1 })} disabled={running} onClick={() => tryExample(n)}>
                      {n + 1}
                    </button>
                  ))}
                </span>
              )}
              <span className={cn(s.pix, s.muted, "ml-auto text-[11px] tabular-nums")}>
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

          {phase === "intake" && <Feed items={state.intakeFeed} />}
          {state.intake && (
            <div className="grid gap-3">
              {state.intake.goal && <p className={s.goal}>{state.intake.goal}</p>}
              {!!state.intake.you.length && (
                <ul className={s.chips}>
                  {state.intake.you.map((c, i) => (
                    <li key={i}>{c.text}</li>
                  ))}
                </ul>
              )}
              {phase === "asking" && !!state.intake.questions.length && <Questions intake={state.intake} onSend={reply} disabled={mode === "replay" || example} />}
            </div>
          )}

          {state.error && (
            <div className={s.alert} role="alert">
              <span>{t(ERRORS[state.error] ?? msg("That didn’t work. Try again."))}</span>
              {mode !== "replay" && (
                <Link href="/adviser?replay=arjun" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  <HistoryIcon aria-hidden />
                  {t("Watch the recorded run")}
                </Link>
              )}
            </div>
          )}
        </Panel>

        <Panel n={2} title={t("Two advisers argue it out")} state={showDebate ? step2 : "todo"} wait={!showDebate && t("Waiting for your profile")}>
          {showDebate && <DebateColumns study={state.study} work={state.work} running={phase === "debating"} kappy={kappy.side} />}
        </Panel>

        <Panel n={3} title={t("The decision")} state={showDecision ? step3 : "todo"} wait={!showDecision && t("Waiting for both advisers")}>
          {showDecision && (
            <>
              {!passed && (phase === "judging" || phase === "rewriting") && <Feed items={state.judgeFeed} />}
              <AuditBadge phase={phase} checking={state.checking} checked={passed ? (state.audit?.verdicts.length ?? state.checking) : null} blocked={state.blocked} />
              {passed && state.final && <DecisionTable final={state.final} />}
              {phase === "human" && (
                <div className={s.human} role="alert">
                  <b>{t("This advice didn’t pass the check — please talk to a human adviser.")}</b>
                  <Link href="/careers" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    <GraduationCapIcon aria-hidden />
                    {t("Careers")}
                  </Link>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel n={4} title={t("Your roadmap: three plans, your call")} state={passed && state.final ? step4 : "todo"} wait={!(passed && state.final) && t("Shown after the check passes")}>
          {passed && state.final && (
            <Roadmap
              final={state.final}
              phase={phase}
              mode={mode}
              plans={state.plans}
              plansFeed={state.plansFeed}
              plansError={state.plansError}
              plansDemo={state.plansDemo}
              review={state.review}
              reviewFeed={state.reviewFeed}
              reviewError={state.reviewError}
              onRetry={retry}
              onChoose={kappy.choose}
              onSaved={kappy.celebrate}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
