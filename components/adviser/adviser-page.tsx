"use client";

import { SparklesIcon } from "lucide-react";
import { AdviserContext } from "@/components/agent/AdviserDock";
import { useT } from "@/components/i18n/I18nProvider";
import { AdviserApp } from "./adviser-app";
import { AdviserErrorBoundary } from "./error-boundary";

// The /adviser page shell for AI adviser v2: the heading and the adviser area inside an error boundary.

export function AdviserPageV2() {
  const t = useT();
  return (
    <div className="ui min-h-svh bg-muted/30 pt-(--ui-header) text-foreground">
      <AdviserContext page="adviser" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <SparklesIcon className="size-3.5" aria-hidden />
          {t("AI adviser")}
        </p>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("Master’s first, or work first?")}</h1>
        <AdviserErrorBoundary>
          <AdviserApp />
        </AdviserErrorBoundary>
      </div>
    </div>
  );
}
