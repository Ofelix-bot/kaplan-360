"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditRequest, AuditResponse, Final, PageContext, Verdict } from "@/lib/agent/types";
import type { AdviserEvent, CaseRequest, CaseResult, IntakeRequest, IntakeResult, JudgeRequest, PlansRequest, PlansResult, ReviewRequest, ReviewResult } from "@/lib/adviser/types";
import type { Locale } from "@/lib/i18n/config";
import type { PlanAnswers } from "@/lib/plan-storage";
import { MOCK_RUN } from "./mock-run";
import { postStage, replayStage, StageFailure, type ErrorCode } from "./transport";

// AI adviser v2's state machine in the browser: idle → intake → asking → debating → judging → auditing
// → (rewriting → auditing) → planning → reviewing → done | human | error. Each stage is one POST to /api/adviser/*
// (components/adviser/transport.ts); the two cases run in parallel. Once the audit passes, the planner drafts three plans
// and Kappy reads them (Step 4, docs/agent/roadmap.md); a failure there leaves Steps 1 to 3 standing, with a retry. Every
// run has an id: events and answers from an older run are dropped, and starting again or leaving the page aborts every
// request. ?mock=1 and ?replay=arjun feed the same machine from recorded events; a recording made before Step 4 existed
// borrows the mock's plans and reading, and the page says so.

export type Phase = "idle" | "intake" | "asking" | "debating" | "judging" | "auditing" | "rewriting" | "planning" | "reviewing" | "done" | "human" | "error";

/** The stages a recording holds, by name: what /adviser/arjun-recorded.json must contain. */
export type StageName = "intake" | "study" | "work" | "judge" | "audit" | "rewrite" | "reaudit" | "plans" | "review";
export type Recording = {
  recordedAt: string;
  stages: Partial<Record<StageName, AdviserEvent[]>>;
  questionsAnswered?: { id: string; answer: string }[];
};

export type FeedItem =
  | { kind: "thinking"; key: string; text: string }
  | { kind: "tool"; key: string; event: Extract<AdviserEvent, { type: "tool" }> };

export type Side = { feed: FeedItem[]; result: CaseResult | null; failed: boolean };

/** One run's handle: its abort controller, whether it is still the current run, and a setState that only it may use. */
type Run = { ctl: AbortController; live: () => boolean; set: (fn: (s: AdviserState) => AdviserState) => void };

export type Mode = "live" | "mock" | "replay";

export type AdviserState = {
  phase: Phase;
  mode: Mode;
  /** recordedAt of a replayed run. */
  recordedAt: string | null;
  intake: IntakeResult | null;
  intakeFeed: FeedItem[];
  study: Side;
  work: Side;
  judgeFeed: FeedItem[];
  /** The judge's answer; shown only once `passed`. */
  final: Final | null;
  /** The audit being shown: checking (null), the blocked first answer, or the passing one. */
  audit: AuditResponse | null;
  /** The first audit's blocked verdicts, kept while the judge rewrites and after. */
  blocked: Verdict[];
  /** How many claims the audit is checking. */
  checking: number;
  passed: boolean;
  error: ErrorCode | null;
  /** Step 4: the three plans and Kappy's reading, each with its live feed; an error there keeps the rest of the run. */
  plans: PlansResult | null;
  plansFeed: FeedItem[];
  plansError: ErrorCode | null;
  /** The plans came from the mock (a recording made before Step 4 existed). */
  plansDemo: boolean;
  review: ReviewResult | null;
  reviewFeed: FeedItem[];
  reviewError: ErrorCode | null;
};

const EMPTY_SIDE: Side = { feed: [], result: null, failed: false };
const EMPTY_INTAKE: IntakeResult = { you: [], goal: "", questions: [] };
const INITIAL: AdviserState = {
  phase: "idle",
  mode: "live",
  recordedAt: null,
  intake: null,
  intakeFeed: [],
  study: EMPTY_SIDE,
  work: EMPTY_SIDE,
  judgeFeed: [],
  final: null,
  audit: null,
  blocked: [],
  checking: 0,
  passed: false,
  error: null,
  plans: null,
  plansFeed: [],
  plansError: null,
  plansDemo: false,
  review: null,
  reviewFeed: [],
  reviewError: null,
};

/** What the server reads as "this side did not finish". */
const placeholder = (side: "study" | "work"): CaseResult => ({
  side,
  thesis: { text: "", sources: [] },
  points: [],
  concede: { text: "", sources: [] },
  conditions: [],
  picks: [],
  roles: [],
  calls: [],
});

/** Claims in a Final, as the audit checks them. */
export const claimCount = (f: Final) => f.analysis.you.length + f.analysis.education.length + f.analysis.career.length + f.decision.rows.length * 2 + 1;

/** One event into a feed: consecutive thinking from the same agent is one entry that grows. */
function addToFeed(feed: FeedItem[], e: AdviserEvent): FeedItem[] {
  if (e.type === "thinking") {
    const last = feed[feed.length - 1];
    if (last?.kind === "thinking") return [...feed.slice(0, -1), { ...last, text: last.text + e.text }];
    return [...feed, { kind: "thinking", key: `t${feed.length}`, text: e.text }];
  }
  if (e.type === "tool") return [...feed, { kind: "tool", key: `${e.id}-${feed.length}`, event: e }];
  return feed;
}

const URL_OF: Record<StageName, string> = {
  intake: "/api/adviser/intake",
  study: "/api/adviser/case?side=study",
  work: "/api/adviser/case?side=work",
  judge: "/api/adviser/judge",
  rewrite: "/api/adviser/judge",
  audit: "/api/adviser/audit",
  reaudit: "/api/adviser/audit",
  plans: "/api/adviser/plans",
  review: "/api/adviser/review",
};

/** What Step 4 needs to run or run again: the run it belongs to, the judge's inputs, the passed decision, and the plans once drafted. */
type Step4 = { run: Run; caseReq: CaseRequest; study: CaseResult; work: CaseResult; final: Final; plans: PlansResult | null };

export type StartInput = { text: string; answers: PlanAnswers; locale: Locale; context: PageContext };

export function useAdviser(mode: Mode) {
  const [state, setState] = useState<AdviserState>({ ...INITIAL, mode });
  const runRef = useRef(0);
  const ctlRef = useRef<AbortController | null>(null);
  const inputRef = useRef<StartInput | null>(null);
  const recordingRef = useRef<Recording | null>(null);

  useEffect(
    () => () => {
      runRef.current++;
      ctlRef.current?.abort();
    },
    [],
  );

  const step4 = useRef<Step4 | null>(null);
  const busy4 = useRef(false);

  /** A fresh run: the old one's requests are aborted and its late events dropped. */
  const begin = (): Run => {
    ctlRef.current?.abort();
    const ctl = new AbortController();
    ctlRef.current = ctl;
    const id = ++runRef.current;
    const live = () => runRef.current === id;
    const set = (fn: (s: AdviserState) => AdviserState) => {
      if (live()) setState(fn);
    };
    return { ctl, live, set };
  };

  /** One stage through the right transport. onEvent runs only while this run is current. */
  const stage = useCallback(
    async (name: StageName, body: unknown, run: ReturnType<typeof begin>, onEvent: (e: AdviserEvent) => void, onRetry: () => void) => {
      const guarded = (e: AdviserEvent) => run.live() && onEvent(e);
      if (mode === "live") return postStage(URL_OF[name], body, guarded, run.ctl.signal, onRetry);
      if (mode === "mock") return replayStage(MOCK_RUN.stages[name], guarded, run.ctl.signal);
      let rec = recordingRef.current;
      if (!rec) {
        const res = await fetch("/adviser/arjun-recorded.json", { signal: run.ctl.signal }).catch(() => null);
        const json = res?.ok ? ((await res.json().catch(() => null)) as Recording | null) : null;
        if (!json || typeof json !== "object" || !json.stages) throw new StageFailure("missing");
        rec = json;
        recordingRef.current = json;
        run.set((s) => ({ ...s, recordedAt: typeof json.recordedAt === "string" ? json.recordedAt : null }));
      }
      // A recording made before Step 4 existed: the mock's plans and reading stand in, and the page says so.
      if (!rec.stages[name] && (name === "plans" || name === "review")) {
        run.set((s) => ({ ...s, plansDemo: true }));
        return replayStage(MOCK_RUN.stages[name], guarded, run.ctl.signal);
      }
      return replayStage(rec.stages[name], guarded, run.ctl.signal);
    },
    [mode],
  );

  /** Step 4a: the planner drafts three plans from the passed decision. Null when it failed (the page offers a retry). */
  const plansStage = useCallback(
    async (x: Step4): Promise<PlansResult | null> => {
      const { run } = x;
      run.set((s) => ({ ...s, phase: "planning", plans: null, plansFeed: [], plansError: null, review: null, reviewFeed: [], reviewError: null }));
      const body: PlansRequest = { ...x.caseReq, study: x.study, work: x.work, final: x.final };
      try {
        const r = (await stage(
          "plans",
          body,
          run,
          (e) => run.set((s) => ({ ...s, plansFeed: addToFeed(s.plansFeed, e) })),
          () => run.set((s) => ({ ...s, plansFeed: [] })),
        )) as PlansResult;
        if (!r || !Array.isArray(r.plans) || r.plans.length !== 3) throw new StageFailure("failed");
        x.plans = r;
        run.set((s) => ({ ...s, plans: r }));
        return r;
      } catch (e) {
        if (run.ctl.signal.aborted) throw e;
        run.set((s) => ({ ...s, phase: "done", plansError: e instanceof StageFailure ? e.code : "failed" }));
        return null;
      }
    },
    [stage],
  );

  /** Step 4b: Kappy reads the three plans. The run ends "done" either way; a failure shows a retry under the plans. */
  const reviewStage = useCallback(
    async (x: Step4, plans: PlansResult) => {
      const { run } = x;
      const input = inputRef.current;
      if (!input) return;
      run.set((s) => ({ ...s, phase: "reviewing", review: null, reviewFeed: [], reviewError: null }));
      const body: ReviewRequest = { locale: input.locale, context: input.context, answers: input.answers, text: input.text, final: x.final, plans, calls: [...x.study.calls, ...x.work.calls] };
      try {
        const r = (await stage(
          "review",
          body,
          run,
          (e) => run.set((s) => ({ ...s, reviewFeed: addToFeed(s.reviewFeed, e) })),
          () => run.set((s) => ({ ...s, reviewFeed: [] })),
        )) as ReviewResult;
        if (!r || !Array.isArray(r.paragraphs) || !r.paragraphs.length) throw new StageFailure("failed");
        run.set((s) => ({ ...s, phase: "done", review: r }));
      } catch (e) {
        if (run.ctl.signal.aborted) throw e;
        run.set((s) => ({ ...s, phase: "done", reviewError: e instanceof StageFailure ? e.code : "failed" }));
      }
    },
    [stage],
  );

  /** Step 4, both halves; the inputs stay in step4 so either half can run again. */
  const roadmap = useCallback(
    async (x: Step4) => {
      step4.current = x;
      busy4.current = true;
      try {
        const plans = await plansStage(x);
        if (plans && x.run.live()) await reviewStage(x, plans);
      } finally {
        busy4.current = false;
      }
    },
    [plansStage, reviewStage],
  );

  /** Steps 2–4: the two cases in parallel, the judge, the audit, and at most one rewrite. */
  const debate = useCallback(
    async (intake: IntakeResult, replies: { id: string; answer: string }[], run: ReturnType<typeof begin>) => {
      const x = inputRef.current;
      if (!x) return;
      const base = { locale: x.locale, context: x.context, answers: x.answers, text: x.text };
      run.set((s) => ({ ...s, phase: "debating", study: EMPTY_SIDE, work: EMPTY_SIDE }));
      const caseReq: CaseRequest = { ...base, intake, replies };
      const side = async (name: "study" | "work") => {
        const r = await stage(
          name,
          caseReq,
          run,
          (e) => run.set((s) => ({ ...s, [name]: { ...s[name], feed: addToFeed(s[name].feed, e) } })),
          () => run.set((s) => ({ ...s, [name]: EMPTY_SIDE })),
        );
        const result = r as CaseResult;
        run.set((s) => ({ ...s, [name]: { ...s[name], result } }));
        return result;
      };
      const [study, work] = await Promise.allSettled([side("study"), side("work")]);
      if (!run.live()) return;
      const failedOf = (r: PromiseSettledResult<CaseResult>) => (r.status === "rejected" ? (r.reason instanceof StageFailure ? r.reason.code : "failed") : null);
      const studyFail = failedOf(study);
      const workFail = failedOf(work);
      run.set((s) => ({ ...s, study: { ...s.study, failed: !!studyFail }, work: { ...s.work, failed: !!workFail } }));
      if (studyFail && workFail) {
        run.set((s) => ({ ...s, phase: "error", error: studyFail === "busy" || workFail === "busy" ? "busy" : studyFail }));
        return;
      }
      const judgeReq: JudgeRequest = {
        ...caseReq,
        study: study.status === "fulfilled" ? study.value : placeholder("study"),
        work: work.status === "fulfilled" ? work.value : placeholder("work"),
      };

      const judge = async (name: "judge" | "rewrite", body: JudgeRequest) => {
        run.set((s) => ({ ...s, judgeFeed: [] }));
        return (await stage(
          name,
          body,
          run,
          (e) => run.set((s) => ({ ...s, judgeFeed: addToFeed(s.judgeFeed, e) })),
          () => run.set((s) => ({ ...s, judgeFeed: [] })),
        )) as Final;
      };
      const audit = async (name: "audit" | "reaudit", final: Final): Promise<AuditResponse | null> => {
        run.set((s) => ({ ...s, phase: "auditing", audit: null, checking: claimCount(final) }));
        const body: AuditRequest = { ...base, final };
        try {
          const r = (await stage(name, body, run, () => {}, () => {})) as AuditResponse;
          return r && Array.isArray(r.verdicts) ? r : null;
        } catch (e) {
          if (run.ctl.signal.aborted) throw e;
          return null;
        }
      };

      run.set((s) => ({ ...s, phase: "judging" }));
      let first: Final;
      try {
        first = await judge("judge", judgeReq);
      } catch (e) {
        run.set((s) => ({ ...s, phase: "error", error: e instanceof StageFailure ? e.code : "failed" }));
        return;
      }
      run.set((s) => ({ ...s, final: first }));
      const a1 = await audit("audit", first);
      if (a1 && !a1.blocked) {
        run.set((s) => ({ ...s, audit: a1, passed: true }));
        return roadmap({ run, caseReq, study: judgeReq.study, work: judgeReq.work, final: first, plans: null });
      }
      // Blocked, or the audit itself failed: the judge rewrites once.
      const fix = a1 ? a1.verdicts.filter((v) => v.status !== "supported") : [];
      run.set((s) => ({ ...s, phase: "rewriting", audit: a1, blocked: fix }));
      let second: Final;
      try {
        second = await judge("rewrite", { ...judgeReq, fix, previous: first });
      } catch {
        run.set((s) => ({ ...s, phase: "human" }));
        return;
      }
      run.set((s) => ({ ...s, final: second }));
      const a2 = await audit("reaudit", second);
      if (a2 && !a2.blocked) {
        run.set((s) => ({ ...s, audit: a2, passed: true }));
        return roadmap({ run, caseReq, study: judgeReq.study, work: judgeReq.work, final: second, plans: null });
      }
      run.set((s) => ({ ...s, phase: "human", audit: a2 }));
    },
    [stage, roadmap],
  );

  /** Step 4 again, after a failure: the three plans from scratch, or only Kappy's reading of the plans already drafted. */
  const retry = useCallback(
    (which: "plans" | "review") => {
      const x = step4.current;
      if (!x || !x.run.live() || busy4.current) return;
      if (which === "plans" || !x.plans) {
        roadmap(x).catch(() => {});
        return;
      }
      busy4.current = true;
      reviewStage(x, x.plans)
        .catch(() => {})
        .finally(() => {
          busy4.current = false;
        });
    },
    [roadmap, reviewStage],
  );

  const pending = useRef<{ intake: IntakeResult; run: ReturnType<typeof begin> } | null>(null);

  const start = useCallback(
    async (x: StartInput) => {
      const run = begin();
      inputRef.current = x;
      pending.current = null;
      setState({ ...INITIAL, mode, recordedAt: recordingRef.current?.recordedAt ?? null, phase: "intake" });
      const body: IntakeRequest = { locale: x.locale, context: x.context, answers: x.answers, text: x.text };
      let intake = EMPTY_INTAKE;
      try {
        const r = (await stage(
          "intake",
          body,
          run,
          (e) => run.set((s) => ({ ...s, intakeFeed: addToFeed(s.intakeFeed, e) })),
          () => run.set((s) => ({ ...s, intakeFeed: [] })),
        )) as IntakeResult;
        if (r && Array.isArray(r.you) && Array.isArray(r.questions)) intake = { you: r.you, goal: r.goal ?? "", questions: r.questions };
      } catch (e) {
        if (run.ctl.signal.aborted) return;
        // A missing recording is the only intake failure the page shows; any other skips the questions.
        if (e instanceof StageFailure && e.code === "missing") {
          run.set((s) => ({ ...s, phase: "error", error: "missing" }));
          return;
        }
      }
      if (!run.live()) return;
      run.set((s) => ({ ...s, intake }));
      if (intake.questions.length) {
        if (mode === "replay") {
          // A recorded run answers as it was answered.
          run.set((s) => ({ ...s, phase: "asking" }));
          await new Promise((r) => setTimeout(r, 1200));
          if (!run.live()) return;
          const answered = recordingRef.current?.questionsAnswered ?? intake.questions.map((q) => ({ id: q.id, answer: q.options[0] ?? "" }));
          return debate(intake, answered, run).catch(() => {});
        }
        pending.current = { intake, run };
        run.set((s) => ({ ...s, phase: "asking" }));
        return;
      }
      return debate(intake, [], run).catch(() => {});
    },
    [debate, stage, mode],
  );

  /** The student's answers to the intake's questions. */
  const reply = useCallback(
    (replies: { id: string; answer: string }[]) => {
      const p = pending.current;
      if (!p || !p.run.live()) return;
      pending.current = null;
      debate(p.intake, replies, p.run).catch(() => {});
    },
    [debate],
  );

  const reset = useCallback(() => {
    runRef.current++;
    ctlRef.current?.abort();
    pending.current = null;
    step4.current = null;
    busy4.current = false;
    setState({ ...INITIAL, mode });
  }, [mode]);

  return { state, start, reply, reset, retry };
}
