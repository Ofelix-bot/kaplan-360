"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { Toaster } from "@/components/ui/toast";
import { useHomeAnswers } from "@/lib/home/answers";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import { startPlanStore } from "@/lib/workspace/plan-store";
import { Clock } from "./clock";
import { CommandPalette } from "./command-palette";
import { FinePrint } from "./fine-print";
import { FloatingNav } from "./floating-nav";
import { Moves } from "./moves";
import { ReceiptsSheet } from "../receipts";
import { Rules } from "./rules";
import { Start } from "./start";
import { Watch, type WatchData } from "./watch";

// The homepage under the hero: six sections built on the /results stack (shadcn/ui on Base UI,
// Motion, dnd-kit, resizable panels, Zustand), with the page's own floating navigation, search,
// receipts sheet and notifications. The visitor's answers come from their Start planning answers in
// this browser; the date is the browser's, so the clock shows placeholders until it is known.

const noSubscribe = () => () => {};

function useToday() {
  const day = useSyncExternalStore(
    noSubscribe,
    () => new Date().toDateString(),
    () => null,
  );
  return useMemo(() => (day ? new Date(day) : null), [day]);
}

export function HomeSections({
  watch,
  sentence,
  programmes,
  disciplines,
  schools,
}: {
  watch: WatchData;
  /** Whether "Describe yourself" can read a sentence here (the server has the key). */
  sentence: boolean;
  programmes: KaplanProgrammeOption[];
  disciplines: Record<string, string>;
  schools: SchoolOption[];
}) {
  const t = useT();
  const today = useToday();
  const answers = useHomeAnswers(today);

  useEffect(() => {
    startPlanStore();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="ui">
        <Clock today={today} answers={answers} />
        <Rules residency={answers.residency} />
        <FinePrint />
        <Moves residency={answers.residency} />
        <Watch data={watch} />
        <Start sentence={sentence} programmes={programmes} disciplines={disciplines} schools={schools} />
        <FloatingNav answers={answers} today={today} />
        <CommandPalette residency={answers.residency} />
        <ReceiptsSheet />
        <Toaster closeLabel={t("Close")} />
      </div>
    </MotionConfig>
  );
}
