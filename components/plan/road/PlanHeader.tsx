"use client";

import { ArrowLeftIcon, CalendarPlusIcon, DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { Button } from "@/components/ui/button";
import type { PlanRule } from "@/lib/plan-timeline";
import { EditSheet } from "./EditSheet";
import { FOCUS, RuleQuote } from "./parts";

// The top of /plan: the worked-example banner while an example student is open, the way back to Programmes, the two-line heading
// ("Your plan. / Master's in Jan 2030."), what the plan is built from with Edit, and the PDF and
// calendar beside the heading (above it on a phone). A university's rule on how recent the English score
// must be, when the meta line says that score, sits one tap under it.

export type Save = { onSave: (kind: "pdf" | "ics") => void; busy: boolean };

export function PlanHeader({ start, count, facts, rules = [], save }: { start: string | null; count?: number; facts?: string[]; rules?: PlanRule[]; save?: Save }) {
  const t = useT();
  const buttons = save && <SaveButtons {...save} />;
  return (
    <header className="flex flex-col gap-4">
      <ExampleBannerUi />
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href="/results" className={cn("inline-flex items-center gap-1 text-[14px] font-medium text-muted-foreground hover:text-foreground", FOCUS)}>
          <ArrowLeftIcon aria-hidden className="size-4" />
          {t("Programmes")}
        </Link>
        <span className="sm:hidden">{buttons}</span>
      </div>
      {/* The buttons sit beside the heading's short first line. */}
      <div className="relative">
        <h1 className="font-heading text-[30px] leading-[1.08] font-bold tracking-[-0.02em] break-keep text-balance sm:text-[44px] lg:text-[48px]">
          <span className="block">{t("Your plan.")}</span>
          {start && <span className="block text-(--brand-ink)">{t("Master’s in {date}.", { date: start })}</span>}
        </h1>
        <span className="absolute top-1.5 right-0 max-sm:hidden">{buttons}</span>
      </div>
      {start && count != null && (
        <p className="text-[15px] leading-relaxed text-pretty text-(--land-body)">
          {t(count === 1 ? "Built from ★ 1 programme and your answers" : "Built from ★ {n} programmes and your answers", { n: count })}
          {(facts ?? []).map((f) => (
            <span key={f}>
              {" · "}
              <span className="whitespace-nowrap">{f}</span>
            </span>
          ))}
          {" · "}
          <EditSheet start={start} />
        </p>
      )}
      {start && rules.length > 0 && (
        <div className="-mt-2 flex flex-col gap-1.5">
          {rules.map((r) => (
            <RuleQuote key={`${r.label}|${r.quote}`} rule={r} />
          ))}
        </div>
      )}
    </header>
  );
}

/** The Button's own focus ring is half-transparent: a full one, as on the rest of the road. */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";

/** Two small buttons: the PDF and the calendar file, both made on the device. */
function SaveButtons({ onSave, busy }: Save) {
  const t = useT();
  return (
    <span className="flex items-center gap-2">
      <Button variant="outline" className={RING} onClick={() => onSave("pdf")} disabled={busy} aria-label={busy ? t("Making PDF…") : t("Download PDF")}>
        {busy ? <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" /> : <DownloadIcon aria-hidden />}
        {t("PDF")}
      </Button>
      <Button variant="outline" className={RING} onClick={() => onSave("ics")} aria-label={t("Add to calendar")}>
        <CalendarPlusIcon aria-hidden />
        {t("Calendar")}
      </Button>
    </span>
  );
}
