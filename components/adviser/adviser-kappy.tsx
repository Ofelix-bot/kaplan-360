"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import type { KappyEngine, Tool } from "@/components/kappy/engine";
import { Kappy, KappyBubble } from "@/components/kappy/Kappy";
import type { AdviserEvent } from "@/lib/adviser/types";
import css from "./adviser-kappy.module.css";
import type { AdviserState, FeedItem, Side } from "./use-adviser";

// Kappy on /adviser, driven by the adviser's own state (use-adviser.ts), never by a script: it listens while the student
// types, thinks with the agents' thinking in its bubble, flashes the lookup's icon on its chest, splits into the two
// debate advisers (the cap and the briefcase in Step 2's columns), lights its bulb only once the audit passes, turns red
// when the audit blocks, and hands off to a person when it blocks twice. While this page shows Kappy, the corner one hides
// (html[data-kappy-here], components/kappy/kappy.module.css).

type Ref = React.RefObject<KappyEngine | null>;

const ICON: Partial<Record<Extract<AdviserEvent, { type: "tool" }>["tool"], Tool>> = {
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

/** Says each new tool line and, at most every 2.5 s, the latest thinking. */
function useFeed(kappy: Ref, feed: FeedItem[]) {
  const seen = useRef(0);
  const saidAt = useRef(0);
  useEffect(() => {
    const k = kappy.current;
    if (feed.length < seen.current) seen.current = 0;
    if (!k) return;
    const fresh = feed.slice(seen.current);
    seen.current = feed.length;
    const tool = [...fresh].reverse().find((f) => f.kind === "tool");
    if (tool?.kind === "tool") {
      k.showTool(ICON[tool.event.tool] ?? "chart", 1100);
      k.say(tool.event.summary);
      saidAt.current = Date.now();
      return;
    }
    const last = feed[feed.length - 1];
    if (last?.kind === "thinking" && Date.now() - saidAt.current > 2500) {
      k.say(tail(last.text));
      saidAt.current = Date.now();
    }
  }, [kappy, feed]);
}

/** A debate adviser: thinking while its side runs, a flash when its case is in. */
function useSide(kappy: Ref, side: Side, running: boolean, done: string, failed: string) {
  useFeed(kappy, side.feed);
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
  }, [kappy, has, side.failed, running, done, failed]);
}

export function useAdviserKappy(state: AdviserState) {
  const t = useT();
  const main = useRef<KappyEngine | null>(null);
  const study = useRef<KappyEngine | null>(null);
  const work = useRef<KappyEngine | null>(null);
  const mainBubble = useRef<HTMLDivElement>(null);
  const studyBubble = useRef<HTMLDivElement>(null);
  const workBubble = useRef<HTMLDivElement>(null);
  const { phase, passed } = state;
  const prev = useRef(phase);

  useEffect(() => {
    document.documentElement.dataset.kappyHere = "";
    return () => void delete document.documentElement.dataset.kappyHere;
  }, []);

  useEffect(() => {
    const k = main.current;
    const was = prev.current;
    prev.current = phase;
    if (!k) return;
    let later: number | undefined;
    if (was === "intake" && phase !== "intake" && phase !== "error") k.flash();
    if (was === "judging" && phase === "auditing") k.flash();
    if (was === "debating" && phase !== "debating") k.burst("puff", 9);
    if (phase === "idle") {
      k.unlight();
      k.set("idle");
      k.say(t("Tell me about yourself, and I'll weigh a master's first against work first."));
    } else if (phase === "intake") {
      k.unlight();
      k.set("think");
      k.say(t("First, your situation: degree, pass, budget…"));
    } else if (phase === "asking") {
      k.set("idle");
      k.say(t("One thing to check before I go on."));
    } else if (phase === "debating") {
      k.burst("puff", 9);
      k.hush();
    } else if (phase === "judging") {
      k.set("think");
      k.say(t("I've read both cases. Now the decision…"));
    } else if (phase === "auditing") {
      k.set("think");
      k.say(t("A second AI is checking each line against the official pages…"));
    } else if (phase === "rewriting") {
      k.set("blocked");
      k.say(t("A line doesn't match the official page. Fixing it."));
      later = window.setTimeout(() => k.set("think"), 2000);
    } else if (phase === "done" && passed) {
      k.set("done");
      k.light();
      k.say(t("Every figure checks out. Here's your roadmap."));
    } else if (phase === "human") {
      k.set("human");
      k.say(t("Both checks failed. Please ask a human adviser this time →"));
    } else if (phase === "error") {
      k.unlight();
      k.set("idle");
      k.say(t("That didn't work. Try again."));
    }
    return () => window.clearTimeout(later);
  }, [phase, passed, t]);

  useFeed(main, phase === "intake" ? state.intakeFeed : state.judgeFeed);
  useSide(study, state.study, phase === "debating", t("My case is ready."), t("This side couldn’t finish"));
  useSide(work, state.work, phase === "debating", t("My case is ready."), t("This side couldn’t finish"));

  return {
    /** Call from the text box's onChange. */
    hear: (el: Element) => main.current?.hear(el),
    celebrate: () => {
      main.current?.celebrate();
      main.current?.say(t("Saved to your plan. You can undo it."));
    },
    main: (
      <div className={css.main}>
        <Kappy ref={main} bubble={mainBubble} away={phase === "debating"} label={t("Kappy, the AI adviser: click to wave")} poke={t("Ask me: master's first, or work first?")} />
        <KappyBubble ref={mainBubble} />
      </div>
    ),
    side: (which: "study" | "work") => (
      <div className={css.side}>
        <Kappy
          ref={which === "study" ? study : work}
          bubble={which === "study" ? studyBubble : workBubble}
          acc={which === "study" ? "cap" : "case"}
          label={which === "study" ? t("The master's-first adviser") : t("The work-first adviser")}
          poke={which === "study" ? t("I argue for a master's first.") : t("I argue for working first.")}
        />
        <KappyBubble ref={which === "study" ? studyBubble : workBubble} empty />
      </div>
    ),
  };
}
