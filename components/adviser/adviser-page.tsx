"use client";

import { AdviserContext } from "@/components/agent/AdviserDock";
import { useT } from "@/components/i18n/I18nProvider";
import { cn } from "cn";
import s from "./adviser.module.css";
import { AdviserApp } from "./adviser-app";
import { AdviserErrorBoundary } from "./error-boundary";
import { pixelFont } from "./pixel-font";

// The /adviser page shell for AI adviser v2, in Kappy's design language (adviser.module.css): the pixel eyebrow, the
// question in the wide display face, and the adviser area inside an error boundary, on the site's lavender.

export function AdviserPageV2() {
  const t = useT();
  return (
    <div className={cn("ui min-h-svh pt-(--ui-header)", s.page, pixelFont.variable)}>
      <AdviserContext page="adviser" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className={cn(s.eyebrow, "mb-2")}>Kaplan 360++ · {t("AI adviser")}</p>
        <h1 className={cn(s.title, "mb-6")}>{t("Master’s first, or work first?")}</h1>
        <AdviserErrorBoundary>
          <AdviserApp />
        </AdviserErrorBoundary>
      </div>
    </div>
  );
}
