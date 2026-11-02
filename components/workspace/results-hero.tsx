"use client";

import { useMemo, type RefObject } from "react";
import { ArrowDownIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { ENTRANCE, entrance, transitions } from "@/lib/motion";
import { useResultsData } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";

// The top of /results, above the workspace: what the list holds (fixed totals from the data, and
// the rank source every card shows), the page's heading and one button that takes the student to
// the filters, on the sentence box where the server can read one. Each part fades up once, in turn.

const n = (v: number) => v.toLocaleString("en-SG");

/** A count, or a blank of about its width while the data loads (so the pill doesn't jump). */
function Total({ value, label }: { value: number | undefined; label: (n: string) => string }) {
  if (value === undefined) return <span className="inline-block w-24" />;
  return <span>{label(n(value))}</span>;
}

export function ResultsHero({ frameRef, sentence }: { frameRef: RefObject<HTMLDivElement | null>; sentence: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  const data = useResultsData((s) => s.data);
  const universities = useMemo(() => (data ? new Set(data.programmes.map((p) => p.u)).size : undefined), [data]);
  const step = (i: number) => ({ ...entrance, transition: { ...ENTRANCE, delay: i * 0.06 } });

  // To the filters: the sentence box where there is one (it takes the focus), else the first filter.
  const start = () => {
    const ws = useWorkspace.getState();
    ws.setView("programmes");
    if (sentence) {
      ws.setTab("ask");
      ws.setAskFocus(true);
    }
    ws.requestFilters();
    // After the panel has expanded, so its growth can't move the target mid-scroll.
    requestAnimationFrame(() => frameRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }));
  };

  return (
    <section aria-labelledby="results-title" className="home-wrap flex flex-col items-center gap-3 pt-6 pb-6 text-center sm:gap-5 sm:pt-12 sm:pb-10 lg:min-h-[calc(48dvh-var(--ui-header))] lg:justify-center lg:gap-6 lg:pt-14 lg:pb-12">
      <motion.p {...step(0)} className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-full border border-(--rs-pill-border) bg-(--rs-pill-bg) px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm sm:gap-x-2 sm:px-4 sm:py-2">
        <Total value={data?.programmes.length} label={(v) => t("{n} programmes", { n: v })} />
        <span aria-hidden className="max-sm:hidden">
          ·
        </span>
        <span className="max-sm:hidden">
          <Total value={universities} label={(v) => t("{n} universities", { n: v })} />
        </span>
        <span aria-hidden>·</span>
        <span>QS 2027</span>
      </motion.p>
      <motion.h1 {...step(1)} id="results-title" className="rs-title font-heading text-[2rem] leading-tight sm:text-4xl font-medium tracking-[-0.05em] text-balance md:text-5xl lg:text-6xl">
        {t("Programmes for you")}
      </motion.h1>
      <motion.div {...step(2)} className="flex w-full justify-center">
        <motion.button
          type="button"
          onClick={start}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={transitions.popup}
          className="inline-flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-linear-to-b from-(--rs-cta) via-(--rs-cta)/95 to-(--rs-cta)/60 px-6 text-sm font-medium text-(--rs-cta-fg) shadow-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-12 sm:w-auto sm:px-8"
        >
          {sentence ? t("Describe yourself") : t("Filters")}
          <ArrowDownIcon className="size-4" />
        </motion.button>
      </motion.div>
    </section>
  );
}
