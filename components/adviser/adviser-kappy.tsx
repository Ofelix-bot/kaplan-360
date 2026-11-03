"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import type { KappyEngine, Tool } from "@/components/kappy/engine";
import { Kappy, KappyBubble } from "@/components/kappy/Kappy";
import { KappyMic } from "@/components/kappy/KappyMic";
import type { AdviserEvent, PlanId } from "@/lib/adviser/types";
import { cn } from "cn";
import s from "./adviser.module.css";
import type { AdviserState, FeedItem, Side } from "./use-adviser";

// Kappy on /adviser, driven by the adviser's own state (use-adviser.ts), never by a script: it listens while the student
// types, thinks with the agents' thinking in its bubble, flashes the lookup's icon on its chest, splits into the two
// debate advisers (the cap and the briefcase in Step 2's columns), turns red when the audit blocks, lights its bulb once
// the audit passes and keeps it lit while the plans are drafted and read, waves at the plan the student picks,
// celebrates a save, and hands off to a person when the audit blocks twice. It stands in the page's head at 3x; once the
// head scrolls under the site header, a slim bar keeps a 1x Kappy, the steps and its bubble in view. The two are the
// same Kappy: every call goes to both. While this page shows Kappy, the corner one hides (html[data-kappy-here],
// components/kappy/kappy.module.css).

type Ref = React.RefObject<KappyEngine | null>;
type Each = (fn: (k: KappyEngine) => void) => void;

/** The chest-screen icon for a lookup (docs/agent/kappy.md). */
export const TOOL_ICON: Partial<Record<Extract<AdviserEvent, { type: "tool" }>["tool"], Tool>> = {
  search_programmes: "school",
  admit_rate: "school",
  hot_roles: "case",
  skill_gap: "case",
  ep_check: "pass",
  outcomes_figures: "chart",
  compare_roads: "chart",
};

/** The last sentence of an agent's thinking, short enough for a bubble. */
function tail(text: string) {
  const parts = text.trim().split(/(?<=[.!?。！？])\s*/).filter((s) => s.trim().length > 3);
  const last = (parts[parts.length - 1] ?? text).trim();
  return last.length > 110 ? `…${last.slice(-110)}` : last;
}

/**
 * Shows each new lookup's icon and, unless quiet, says its line and at most every 2.5 s the latest thinking. `source`
 * names the feed being followed: when it changes, what that feed already holds is old news and is not said again.
 */
function useFeed(each: Each, feed: FeedItem[], quiet = false, source = "") {
  const seen = useRef(0);
  const saidAt = useRef(0);
  const followed = useRef(source);
  useEffect(() => {
    if (followed.current !== source) {
      followed.current = source;
      seen.current = feed.length;
      return;
    }
    if (feed.length < seen.current) seen.current = 0;
    const fresh = feed.slice(seen.current);
    seen.current = feed.length;
    const tool = [...fresh].reverse().find((f) => f.kind === "tool");
    if (tool?.kind === "tool") {
      each((k) => k.showTool(TOOL_ICON[tool.event.tool] ?? "chart", 1100));
      if (!quiet) each((k) => k.say(tool.event.summary));
      saidAt.current = Date.now();
      return;
    }
    const last = feed[feed.length - 1];
    if (!quiet && last?.kind === "thinking" && Date.now() - saidAt.current > 2500) {
      each((k) => k.say(tail(last.text)));
      saidAt.current = Date.now();
    }
  }, [each, feed, quiet, source]);
}

/** A debate adviser: thinking while its side runs, a flash when its case is in. Returns the ref its Kappy takes. */
function useSide(side: Side, running: boolean, done: string, failed: string): Ref {
  const kappy = useRef<KappyEngine | null>(null);
  const each = useCallback<Each>((fn) => {
    if (kappy.current) fn(kappy.current);
  }, []);
  useFeed(each, side.feed);
  const has = !!side.result;
  useEffect(() => {
    const k = kappy.current;
    if (!k) return;
    if (side.failed) {
      k.set("human");
      k.say(failed);
    } else if (has) {
      k.set("done");
      k.flash();
      k.say(done);
    } else if (running) k.set("think");
  }, [has, side.failed, running, done, failed]);
  return kappy;
}

export function useAdviserKappy(state: AdviserState) {
  const t = useT();
  const big = useRef<KappyEngine | null>(null);
  const small = useRef<KappyEngine | null>(null);
  const bigBubble = useRef<HTMLDivElement>(null);
  const smallBubble = useRef<HTMLDivElement>(null);
  const studyBubble = useRef<HTMLDivElement>(null);
  const workBubble = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const { phase, passed, plansError, reviewError, review } = state;
  const prev = useRef(phase);
  const each = useCallback<Each>((fn) => {
    for (const r of [big, small]) if (r.current) fn(r.current);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.kappyHere = "";
    return () => void delete document.documentElement.dataset.kappyHere;
  }, []);

  // The bar shows once the whole head is above the site header's bottom edge.
  useEffect(() => {
    const el = head.current;
    if (!el) return;
    const top = parseFloat(getComputedStyle(el).getPropertyValue("--ui-header")) || 68;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < top), { rootMargin: `-${top}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const was = prev.current;
    prev.current = phase;
    let later: number | undefined;
    if (was === "intake" && phase !== "intake" && phase !== "error") each((k) => k.flash());
    if (was === "judging" && phase === "auditing") each((k) => k.flash());
    if (was === "debating" && phase !== "debating") each((k) => k.burst("puff", 9));
    if (phase === "idle") {
      each((k) => {
        k.unlight();
        k.set("idle");
        k.say(t("Tell me about yourself, and I'll weigh a master's first against work first."));
      });
    } else if (phase === "intake") {
      each((k) => {
        k.unlight();
        k.set("think");
        k.say(t("First, your situation: degree, pass, budget…"));
      });
    } else if (phase === "asking") {
      each((k) => {
        k.set("idle");
        k.say(t("One thing to check before I go on."));
      });
    } else if (phase === "debating") {
      each((k) => {
        k.burst("puff", 9);
        k.hush();
      });
    } else if (phase === "judging") {
      each((k) => {
        k.set("think");
        k.say(t("I've read both cases. Now the decision…"));
      });
    } else if (phase === "auditing") {
      each((k) => {
        k.set("think");
        k.say(t("A second AI is checking each line against the official pages…"));
      });
    } else if (phase === "rewriting") {
      each((k) => {
        k.set("blocked");
        k.say(t("A line doesn't match the official page. Fixing it."));
      });
      later = window.setTimeout(() => each((k) => k.set("think")), 2000);
    } else if (phase === "planning") {
      // The audit has just passed: the bulb lights and stays lit while the plans are drafted and read.
      each((k) => {
        if (was !== "planning") k.light();
        k.set("think");
        k.say(t("Drafting three plans from the decision…"));
      });
    } else if (phase === "reviewing") {
      each((k) => {
        k.set("think");
        k.say(t("Reading the three plans. I'll mark what I'd weigh…"));
      });
    } else if (phase === "done" && passed) {
      each((k) => {
        k.set("done");
        k.light();
        k.say(review ? t("Done reading. The choice is yours, not mine.") : t("Every figure checks out. Here's your roadmap."));
      });
    } else if (phase === "human") {
      each((k) => {
        k.set("human");
        k.say(t("Both checks failed. Please ask a human adviser this time →"));
      });
    } else if (phase === "error") {
      each((k) => {
        k.unlight();
        k.set("idle");
        k.say(t("That didn't work. Try again."));
      });
    }
    return () => window.clearTimeout(later);
  }, [phase, passed, review, each, t]);

  // Step 4 failed in part: the lens turns red, and Kappy says which half and what to do.
  useEffect(() => {
    if (!plansError && !reviewError) return;
    each((k) => {
      k.set("blocked");
      k.say(plansError ? t("I couldn't draft the plans this time. Try again, or use the judge's steps below.") : t("I couldn't finish reading the plans. Try again."));
    });
  }, [plansError, reviewError, each, t]);

  const step4 = phase === "planning" || phase === "reviewing";
  const source = phase === "intake" ? "intake" : phase === "planning" ? "plans" : phase === "reviewing" ? "review" : "judge";
  const feeds = { intake: state.intakeFeed, plans: state.plansFeed, review: state.reviewFeed, judge: state.judgeFeed };
  useFeed(each, feeds[source], step4, source);
  const study = useSide(state.study, phase === "debating", t("My case is ready."), t("This side couldn’t finish"));
  const work = useSide(state.work, phase === "debating", t("My case is ready."), t("This side couldn’t finish"));

  const away = phase === "debating";
  return {
    /** Call from the text box's onChange. */
    hear: (el: Element) => each((k) => k.hear(el)),
    /** The student picked a plan (Step 4). */
    choose: (id: PlanId) =>
      each((k) => {
        k.wave();
        k.say(t("Plan {id}: your decision. Save it when you're sure.", { id }));
      }),
    celebrate: () =>
      each((k) => {
        k.celebrate();
        k.say(t("Saved to your plan. You can undo it."));
      }),
    /** The head (Kappy at 3x, the steps, its bubble, its microphone) and the bar that takes over once the head scrolls away. */
    head: (steps: (compact: boolean) => ReactNode, voice?: { value: string; onText: (text: string) => void; disabled?: boolean }) => (
      <>
        <div ref={head} className={cn(s.head, s.grid)}>
          <Kappy ref={big} bubble={bigBubble} away={away} label={t("Kappy, the AI adviser: click to wave")} poke={t("Ask me: master's first, or work first?")} />
          <div className={s.headSide}>
            {steps(false)}
            <KappyBubble ref={bigBubble} className={s.bubbleWide} />
            {voice && !voice.disabled && <KappyMic kappys={() => [big.current, small.current]} value={voice.value} onText={voice.onText} className="justify-self-start" />}
          </div>
        </div>
        {/* A visual copy of the head for a scrolled page: hidden from assistive tech, which already has the head. */}
        <div className={s.stick} data-on={stuck ? "" : undefined} aria-hidden="true" inert>
          <div className={s.bar}>
            <Kappy ref={small} bubble={smallBubble} away={away} />
            <div className={s.barSide}>
              {steps(true)}
              <KappyBubble ref={smallBubble} className={s.bubbleSlim} />
            </div>
          </div>
        </div>
      </>
    ),
    /** A debate column's head: its Kappy (cap or briefcase), its heading and its bubble. */
    side: (which: "study" | "work", heading: ReactNode) => (
      <div className={cn(s.colH, s.grid)}>
        <Kappy
          ref={which === "study" ? study : work}
          bubble={which === "study" ? studyBubble : workBubble}
          acc={which === "study" ? "cap" : "case"}
          label={which === "study" ? t("The master's-first adviser") : t("The work-first adviser")}
          poke={which === "study" ? t("I argue for a master's first.") : t("I argue for working first.")}
        />
        <div className={s.who}>
          {heading}
          <KappyBubble ref={which === "study" ? studyBubble : workBubble} empty className={s.bubbleCol} />
        </div>
      </div>
    ),
  };
}
