"use client";

import { MonitorIcon, SparklesIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { AdviserApp } from "@/components/agent/AdviserApp";
import { AdviserContext } from "@/components/agent/AdviserDock";

// /adviser: the adviser on a page of its own, for narrow screens (where the dock doesn't show) and for links. Phones
// get the same steps in one column and a line saying the desktop shows it beside the page.

export function AdviserPage() {
  const t = useT();
  return (
    <div className="ui min-h-svh bg-background pt-(--ui-header) text-foreground">
      <AdviserContext page="adviser" />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <SparklesIcon className="size-3.5" aria-hidden />
          {t("AI adviser")}
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("Master’s first, or work first?")}</h1>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          {t("Tell the adviser about yourself. It chooses what to look up, asks what it needs, compares the two roads and saves a plan for you. A second AI checks every figure against the official sources.")}
        </p>
        <p className="mb-6 flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground lg:hidden">
          <MonitorIcon className="size-3.5 shrink-0" aria-hidden />
          {t("Works best on a computer: there the adviser opens beside each page.")}
        </p>
        <AdviserApp context={{ page: "adviser" }} />
      </div>
    </div>
  );
}
