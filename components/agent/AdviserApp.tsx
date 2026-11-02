"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRightIcon, BriefcaseIcon, RotateCwIcon, CheckIcon, FileTextIcon, GraduationCapIcon, ShieldAlertIcon, ShieldCheckIcon, SparklesIcon, Undo2Icon, UserIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { VoiceInput } from "@/components/finder/voice-input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/workspace/spinner";
import { useAdviser, type TraceLine } from "@/lib/agent/client";
import { MAX_TEXT, type Claim, type Final, type PageContext, type ToolName } from "@/lib/agent/types";
import { msg } from "@/lib/i18n/translate";
import { useResultsData } from "@/lib/workspace/data";
import { startPlanStore, usePlanStore } from "@/lib/workspace/plan-store";
import { cn } from "cn";

// The AI adviser, laid out as the four steps of the brief: 1 the student's profile and their question, 2 the model's
// analysis (the live trace: each tool it chooses lights up in the Higher education or Career path lane), 3 study on vs
// start work, 4 the roadmap, the skill gaps and the picks it saved to the plan. Steps 2–4 are what the model wrote
// (lib/agent/client.ts runs it); nothing here is worked out by rules. The same component fills the right-hand dock
// (compact: one column) and the /adviser page.

const TOOL_LABEL: Record<ToolName, string> = {
  search_programmes: msg("Searched master’s programmes"),
  admit_rate: msg("Checked your admission match"),
  ep_check: msg("Checked the work-pass rule"),
  hot_roles: msg("Looked up in-demand roles"),
  skill_gap: msg("Compared your skills with the role"),
  outcomes_figures: msg("Read the graduate outcome figures"),
  ask_user: msg("Asked you"),
  save_to_plan: msg("Saved to your plan"),
  finish: msg("Wrote your plan"),
};

const LANE: Record<ToolName, TraceLine["lane"]> = {
  search_programmes: "education",
  admit_rate: "education",
  ep_check: "career",
  hot_roles: "career",
  skill_gap: "career",
  outcomes_figures: "career",
  ask_user: "you",
  save_to_plan: "you",
  finish: "you",
};

const CRITERIA: Record<Final["decision"]["rows"][number]["criterion"], string> = { cost: msg("Cost"), benefit: msg("Benefit"), risk: msg("Risk"), fit: msg("Fit") };

const EXAMPLE = msg(
  "I finish my Murdoch business degree in December. I want a fintech job in Singapore, my parents want me to do a master’s first, and our budget is 400,000 RMB. What should I do?",
);

/** A programme's name from the finder's data when it is loaded, else its id read as words. */
function useProgrammeName() {
  const byId = useResultsData((s) => s.byId);
  return (id: string) => byId?.get(id)?.name ?? id.replace(/^mock-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StepHead({ n, title, state, children }: { n: number; title: string; state: "todo" | "current" | "active" | "done"; children?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
          state === "done" && "border-primary bg-primary text-primary-foreground",
          (state === "active" || state === "current") && "border-primary text-primary",
          state === "todo" && "text-muted-foreground",
        )}
      >
        {state === "done" ? <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden /> : state === "active" ? <Spinner className="size-3.5" /> : n}
      </span>
      <h3 className={cn("text-sm font-semibold", state === "todo" && "text-muted-foreground")}>{title}</h3>
      <div className="ml-auto">{children}</div>
    </div>
  );
}

function Sources({ n }: { n: number }) {
  const t = useT();
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle text-[11px] text-muted-foreground" title={t("{n} official sources", { n })}>
      <FileTextIcon className="size-3" aria-hidden />
      {n}
    </span>
  );
}

function ClaimLine({ c }: { c: Claim }) {
  return (
    <li className="text-sm leading-snug">
      {c.text} <Sources n={c.sources.length} />
    </li>
  );
}

function TraceRow({ l }: { l: TraceLine }) {
  const t = useT();
  const [p, g] = l.tool === "save_to_plan" ? l.summary.split("|") : [];
  return (
    <li className="flex gap-2 text-sm">
      <span className="mt-0.5 shrink-0">{l.pending ? <Spinner className="size-3.5 text-primary" /> : l.retry ? <RotateCwIcon className="size-3.5 text-amber-600" aria-hidden /> : <CheckIcon className="size-3.5 text-primary" strokeWidth={3} aria-hidden />}</span>
      <span className="min-w-0">
        <span className="font-medium">{l.retry ? t("That step took too long: asking the AI again") : t(TOOL_LABEL[l.tool])}</span>
        {l.tool === "save_to_plan" ? (
          <span className="block text-muted-foreground">{t("{p} programmes and {g} skill gaps", { p: Number(p) || 0, g: Number(g) || 0 })}</span>
        ) : (
          l.summary && <span className="block text-muted-foreground">{l.summary}</span>
        )}
        {!l.pending && (l.sources > 0 || l.ms > 0) && (
          <span className="flex gap-2 text-[11px] text-muted-foreground">
            <Sources n={l.sources} />
            {l.ms > 0 && <span>{(l.ms / 1000).toFixed(1)} s</span>}
          </span>
        )}
      </span>
    </li>
  );
}

function Lane({ icon, title, lines, claims }: { icon: ReactNode; title: string; lines: TraceLine[]; claims: Claim[] }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
      </p>
      {lines.length ? <ul className="space-y-2">{lines.map((l) => <TraceRow key={l.id} l={l} />)}</ul> : !claims.length && <p className="text-sm text-muted-foreground">—</p>}
      {!!claims.length && <ul className="mt-3 list-disc space-y-1.5 border-t pt-3 pl-4">{claims.map((c, i) => <ClaimLine key={i} c={c} />)}</ul>}
    </div>
  );
}

/** The question card: the model's question, its suggested answers, and a box for any other answer. */
function Ask() {
  const t = useT();
  const ask = useAdviser((s) => s.ask);
  const answer = useAdviser((s) => s.answer);
  const [text, setText] = useState("");
  if (!ask) return null;
  return (
    <div className="rounded-lg border-2 border-primary/60 bg-primary/5 p-3" role="group" aria-label={t("The adviser asks")}>
      <p className="mb-2 flex items-start gap-1.5 text-sm font-semibold">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {ask.input.question}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ask.input.options.map((o) => (
          <Button key={o} size="sm" variant="outline" onClick={() => answer(o)}>
            {o}
          </Button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          answer(text);
          setText("");
        }}
      >
        <input
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("Or type your answer")}
          aria-label={t("Your answer")}
        />
        <Button size="sm" type="submit" disabled={!text.trim()}>
          {t("Send")}
        </Button>
      </form>
    </div>
  );
}

/** The audit's state: checking, all supported, or blocked and rewritten (with the claim and the official text). */
function Audit() {
  const t = useT();
  const { status, audit, rewritten, blocked, unchecked } = useAdviser();
  const failed = blocked?.verdicts.filter((v) => v.status !== "supported") ?? [];
  return (
    <div className="space-y-2">
      {!!failed.length && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-destructive">
            <ShieldAlertIcon className="size-4" aria-hidden />
            {t("Blocked by a second AI: these lines don’t match the official text")}
          </p>
          <ul className="space-y-2">
            {failed.map((v, i) => (
              <li key={i}>
                <p className="line-through decoration-destructive/60">{v.claim}</p>
                {v.quote && (
                  <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">
                    “{v.quote}”{" "}
                    {v.url && (
                      <a className="underline" href={v.url} target="_blank" rel="noopener noreferrer">
                        {t("Source")}
                      </a>
                    )}
                  </blockquote>
                )}
                {v.note && <p className="mt-1 text-xs text-muted-foreground">{v.note}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-medium">{rewritten && status !== "auditing" ? t("The adviser rewrote its answer with the official text.") : t("Asking the adviser to rewrite…")}</p>
        </div>
      )}
      {status === "auditing" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Spinner className="size-3.5" /> {t("A second AI is checking every figure against the official sources…")}
        </p>
      )}
      {status === "done" && unchecked && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <ShieldAlertIcon className="size-4" aria-hidden />
          {t("The second AI couldn’t finish its check in time: ask a Kaplan adviser before you act on these figures.")}
        </p>
      )}
      {status === "done" && audit && !audit.blocked && !unchecked && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <ShieldCheckIcon className="size-4" aria-hidden />
          {t("Checked by a second AI: every figure matches the official sources")}
        </p>
      )}
      {status === "done" && audit?.blocked && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <ShieldAlertIcon className="size-4" aria-hidden />
          {t("Still not matching the official text after a rewrite: ask a Kaplan adviser before you act on the flagged lines.")}
        </p>
      )}
      {status === "done" && audit?.blocked && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">
          {audit.verdicts
            .filter((v) => v.status !== "supported")
            .map((v, i) => (
              <li key={i}>
                {v.claim}
                {v.note && <span className="text-muted-foreground"> — {v.note}</span>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  unavailable: msg("The adviser isn’t available on this copy of the site."),
  busy: msg("Too many requests just now. Wait a minute and try again."),
  "too-long": msg("That’s too long. Keep it under 800 characters."),
  "too-many-steps": msg("The adviser took too many steps. Try a shorter question."),
};

function profileLine(a: ReturnType<typeof usePlanStore.getState>["answers"], t: ReturnType<typeof useT>): string[] {
  const out: string[] = [];
  if (a.sgStatus) out.push(t(({ citizen: "Singapore citizen", pr: "Permanent resident", "student-pass": "Student’s Pass", "other-pass": "Other pass" } as const)[a.sgStatus]));
  if (a.nationality) out.push(a.nationality);
  if (a.graduationYear) out.push(t("graduates {when}", { when: `${a.graduationMonth ? `${String(a.graduationMonth).padStart(2, "0")}/` : ""}${a.graduationYear}` }));
  if (a.englishTest && a.englishScore) out.push(`${a.englishTest.toUpperCase()} ${a.englishScore}`);
  if (a.degreeGpa) out.push(`GPA ${a.degreeGpa}`);
  else if (a.averageMark) out.push(`${a.averageMark}%`);
  return out;
}

export function AdviserApp({ context, compact = false }: { context: PageContext; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const name = useProgrammeName();
  const { status, trace, final, saved, error, start, undoSave, reset } = useAdviser();
  const answers = usePlanStore((s) => s.answers);
  const example = usePlanStore((s) => s.example);
  const [text, setText] = useState("");
  useEffect(() => startPlanStore(), []);

  const busy = status === "running" || status === "asking" || status === "auditing";
  const started = status !== "idle";
  const ask = () => text.trim() && start({ text: text.trim(), locale, context });
  const lines = (lane: TraceLine["lane"]) => trace.filter((l) => (l.pending ? LANE[l.tool] : l.lane) === lane && l.tool !== "save_to_plan");
  const you = profileLine(answers, t);
  const step2 = final ? "done" : started ? "active" : "todo";
  const step34 = status === "done" ? "done" : final ? "active" : "todo";

  return (
    <div className="space-y-5">
      <section>
        <StepHead n={1} title={t("Your profile")} state={started ? "done" : "current"}>
          <Link href="/profile" className="text-xs text-muted-foreground underline">
            {t("Edit")}
          </Link>
        </StepHead>
        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <UserIcon className="size-3.5" aria-hidden />
          {example && <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{t("Example student")}</span>}
          {you.length ? you.join(" · ") : t("No profile yet: tell the adviser about yourself below.")}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="space-y-2"
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT}
            rows={compact ? 4 : 3}
            placeholder={t("Your degree, your grades, what you enjoy, your budget, and the question you want answered")}
            aria-label={t("Your question for the adviser")}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? <Spinner className="size-4" /> : <SparklesIcon aria-hidden />}
              {t("Ask the AI adviser")}
            </Button>
            <VoiceInput value={text} onChange={setText} maxLength={MAX_TEXT} onUsed={() => {}} />
            {!text && !busy && (
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setText(t(EXAMPLE))}>
                {t("Use an example question")}
              </button>
            )}
            {started && !busy && (
              <button type="button" className="ml-auto text-xs text-muted-foreground underline" onClick={reset}>
                {t("Start again")}
              </button>
            )}
          </div>
        </form>
      </section>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {t(ERRORS[error] ?? msg("Something went wrong. Try again in a moment."))}
        </p>
      )}

      <section aria-live="polite">
        <StepHead n={2} title={t("AI analysis")} state={step2} />
        {lines("you").length > 0 && <ul className="mb-2 space-y-2">{lines("you").map((l) => <TraceRow key={l.id} l={l} />)}</ul>}
        <Ask />
        <div className={cn("mt-2 grid gap-2", !compact && "md:grid-cols-2")}>
          <Lane icon={<GraduationCapIcon className="size-3.5" aria-hidden />} title={t("Higher education")} lines={lines("education")} claims={final?.analysis.education ?? []} />
          <Lane icon={<BriefcaseIcon className="size-3.5" aria-hidden />} title={t("Career path")} lines={lines("career")} claims={final?.analysis.career ?? []} />
        </div>
        {!!final?.analysis.you.length && <ul className="mt-2 list-disc space-y-1.5 pl-4">{final.analysis.you.map((c, i) => <ClaimLine key={i} c={c} />)}</ul>}
      </section>

      <section>
        <StepHead n={3} title={t("Study on or start work?")} state={step34} />
        {final && (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-16 p-2 text-left font-medium" />
                    <th className={cn("p-2 text-left font-semibold", final.decision.lean !== "work" && "text-primary")}>{t("Master’s first")}</th>
                    <th className={cn("p-2 text-left font-semibold", final.decision.lean !== "study" && "text-primary")}>{t("Work first")}</th>
                  </tr>
                </thead>
                <tbody>
                  {final.decision.rows.map((r) => (
                    <tr key={r.criterion} className="border-t align-top">
                      <th className="p-2 text-left text-xs font-medium text-muted-foreground">{t(CRITERIA[r.criterion])}</th>
                      <td className="p-2">
                        {r.study.text} <Sources n={r.study.sources.length} />
                      </td>
                      <td className="p-2">
                        {r.work.text} <Sources n={r.work.sources.length} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rounded-lg bg-primary/5 p-3 text-sm">
              <span className="font-semibold">{t(final.decision.lean === "study" ? "Leans to a master’s first" : final.decision.lean === "work" ? "Leans to work first" : "Both roads work")}:</span> {final.decision.why.text}{" "}
              <Sources n={final.decision.why.sources.length} />
            </p>
          </div>
        )}
      </section>

      <section>
        <StepHead n={4} title={t("Your roadmap")} state={step34} />
        {final && (
          <div className="space-y-3">
            <ol className="space-y-1.5 border-l-2 pl-3">
              {final.roadmap.map((r, i) => (
                <li key={i} className="text-sm">
                  <span className={cn("mr-1.5 font-mono text-xs", r.lane === "education" ? "text-primary" : "text-amber-700 dark:text-amber-400")}>{r.when}</span>
                  {r.text}
                </li>
              ))}
            </ol>
            {!!final.gaps.length && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t("Skill gaps")}</p>
                <ul className="space-y-1 text-sm">
                  {final.gaps.map((g, i) => (
                    <li key={i}>
                      <span className="font-medium">{g.skill}</span>
                      {g.level !== null && <span className="text-muted-foreground"> · {t("level {n}", { n: g.level })}</span>}
                      <span className="text-muted-foreground"> — {g.how}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!final.picks.length && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t("Programmes to look at")}</p>
                <ul className="space-y-1 text-sm">
                  {final.picks.map((p) => (
                    <li key={p.programmeId}>
                      <span className="font-medium">{name(p.programmeId)}</span>
                      <span className="text-muted-foreground"> — {p.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {saved && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
            <CheckIcon className="size-4 text-primary" strokeWidth={3} aria-hidden />
            <span>{t("The adviser saved {p} programmes and {g} skill gaps to your plan.", { p: saved.programmes, g: saved.gaps })}</span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={undoSave}>
                <Undo2Icon aria-hidden />
                {t("Undo")}
              </Button>
              <Link href="/plan" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                {t("Open your plan")} <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            </span>
          </div>
        )}
        {final && <div className="mt-3">{<Audit />}</div>}
      </section>
    </div>
  );
}
