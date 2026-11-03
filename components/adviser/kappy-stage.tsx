"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Kappy, KappyBubble } from "@/components/kappy/Kappy";
import type { KappyEngine, Tool } from "@/components/kappy/engine";
import type { PlanId, PlansResult, ReadTool, ReviewResult } from "@/lib/adviser/types";
import { cn } from "cn";
import type { ErrorCode } from "./transport";
import type { FeedItem, Phase } from "./use-adviser";

// Kappy on the roadmap's stage (Step 4 of the AI adviser v2): the same engine as the corner Kappy, driven by the run.
// It thinks while the planner drafts, flashes an icon for each lookup, pops its bulb when the three plans land, thinks
// again while it reads them, lights up when its reading is in, turns red when a half failed, and celebrates a save.
// What it says is the page's own lines (t()), never model output: the model's words are in the plans and the reading.

/** The chest-screen icon for a lookup (docs/agent/kappy.md). */
const ICON: Record<ReadTool, Tool> = { search_programmes: "school", admit_rate: "school", hot_roles: "case", skill_gap: "case", ep_check: "pass", outcomes_figures: "chart", compare_roads: "chart" };

type Props = {
  phase: Phase;
  plans: PlansResult | null;
  review: ReviewResult | null;
  plansError: ErrorCode | null;
  reviewError: ErrorCode | null;
  /** The lookups the planner made, in order. */
  tools: FeedItem[];
  chosen: PlanId | null;
  saved: boolean;
  className?: string;
};

export function KappyStage({ phase, plans, review, plansError, reviewError, tools, chosen, saved, className }: Props) {
  const t = useT();
  const kappy = useRef<KappyEngine | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const toolCount = tools.filter((i) => i.kind === "tool").length;
  const seenTools = useRef(0);

  // The stage follows the run: one effect per thing that changes, each saying its line once.
  useEffect(() => {
    const k = kappy.current;
    if (!k) return;
    if (phase === "planning") {
      k.unlight();
      k.set("think");
      k.say(t("Drafting three plans from the decision…"));
    } else if (phase === "reviewing") {
      k.set("think");
      k.say(t("Reading the three plans. I'll mark what I'd weigh…"));
    }
  }, [phase, t]);

  useEffect(() => {
    const k = kappy.current;
    if (!k || !plans || phase !== "reviewing") return;
    k.flash();
  }, [plans, phase]);

  useEffect(() => {
    const k = kappy.current;
    if (!k || !review) return;
    k.set("done");
    k.light();
    k.say(t("Done reading. The choice is yours, not mine."));
  }, [review, t]);

  useEffect(() => {
    const k = kappy.current;
    if (!k || (!plansError && !reviewError)) return;
    k.set("blocked");
    k.say(plansError ? t("I couldn't draft the plans this time. Try again, or use the judge's steps below.") : t("I couldn't finish reading the plans. Try again."));
  }, [plansError, reviewError, t]);

  useEffect(() => {
    const k = kappy.current;
    if (!k || toolCount <= seenTools.current) return;
    seenTools.current = toolCount;
    const last = [...tools].reverse().find((i) => i.kind === "tool");
    if (last?.kind === "tool") k.showTool(ICON[last.event.tool] ?? "chart");
  }, [toolCount, tools]);

  useEffect(() => {
    const k = kappy.current;
    if (!k || !chosen || saved) return;
    k.flash();
    k.say(t("Plan {id}: your decision. Save it when you're sure.", { id: chosen }));
  }, [chosen, saved, t]);

  useEffect(() => {
    const k = kappy.current;
    if (!k || !saved) return;
    k.celebrate();
    k.say(t("Saved to your plan. You can undo it."));
  }, [saved, t]);

  return (
    <div className={cn("flex items-end gap-3 [--kappy-scale:1] sm:[--kappy-scale:2]", className)}>
      <Kappy ref={kappy} bubble={bubble} poke={t("I read; you decide.")} label={t("Kappy, the adviser's reading companion: click to wave")} />
      <KappyBubble ref={bubble} className="mb-6 text-sm sm:mb-10" />
    </div>
  );
}
