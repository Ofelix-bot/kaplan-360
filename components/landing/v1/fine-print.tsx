"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheckIcon, ChevronsLeftRightIcon, CircleCheckIcon, CircleHelpIcon, CircleSlashIcon, CircleXIcon, FilterIcon } from "lucide-react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { useLocalName } from "@/components/results/names";
import { toast } from "@/components/ui/toast";
import { AUD_SGD, FINE_PRINT, type FinePrintRow, type Verdict } from "@/lib/home/content";
import { useHome } from "@/lib/home/store";
import { useMediaQuery } from "@/lib/use-media-query";
import { InlineNumber } from "./inline-edit";
import { Quote, ReceiptChip } from "../receipts";
import { VerdictBadge } from "./rules";
import { SectionHead } from "./section-head";
import { Segmented } from "./segmented";

// 03 Fine print: Arjun's three programmes as a filter on fees and entry fields sees them, and as the
// official page puts it, one over the other. Drag the handle (or use the arrow keys on it) to wipe
// between the two; the buttons above jump to either side. His budget can be edited in place, and
// the filter's answers follow it while the official pages' don't.

const ICON: Record<Verdict, typeof CircleCheckIcon> = { meets: CircleCheckIcon, fails: CircleXIcon, check: CircleHelpIcon, neutral: CircleSlashIcon };

type View = "filter" | "split" | "official";

export function FinePrint() {
  const t = useT();
  const locale = useIntlLocale();
  const names = useSiteNames();
  const budget = useHome((s) => s.budget);
  const setBudget = useHome((s) => s.setBudget);
  const phone = useMediaQuery("(max-width: 639px)");
  const reduce = useReducedMotion();
  const half = phone ? 40 : 50;
  const split = useMotionValue(50);
  const splitPct = useTransform(split, (v) => `${v}%`);
  const [view, setView] = useState<View | null>("split");
  const [value, setValue] = useState(50);
  const area = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const money = (n: number) => `S$${n.toLocaleString(locale)}`;
  // Which button matches where the handle is, and the slider's value, follow the drag (not every frame).
  useMotionValueEvent(split, "change", (v) => {
    setView(v > 97 ? "filter" : v < 3 ? "official" : Math.abs(v - half) < 2 ? "split" : null);
    setValue(Math.round(v));
  });
  useEffect(() => {
    if (!dragging.current) split.set(half);
  }, [half, split]);

  const go = (to: number) => (reduce ? split.set(to) : animate(split, to, { type: "spring", stiffness: 260, damping: 30 }));
  const fromPointer = (clientX: number) => {
    const r = area.current?.getBoundingClientRect();
    if (r) split.set(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  const rows = FINE_PRINT.map((row) => {
    const fits = !row.fee || row.fee.sgd <= budget;
    const verdict: Verdict = fits ? "meets" : "neutral";
    const detail = [
      ...row.filterChecks.map((c) => `${t(c)} ✓`),
      row.fee ? (fits ? `${row.fee.approx ? `≈ ${money(row.fee.sgd)}` : row.fee.shown} ✓` : t("Over your {budget} budget ✗", { budget: money(budget) })) : null,
    ].filter(Boolean);
    return { row, fits, verdict, detail: detail.join(" · ") };
  });
  const kept = rows.filter((r) => r.fits).map((r) => r.row.id);
  const summary = kept.length === 3 ? t("With {budget}, the filter keeps all three. Only the official pages tell them apart.", { budget: money(budget) }) : kept.length === 1 ? t("With {budget}, the filter keeps only Murdoch, the one programme with no fee on its page.", { budget: money(budget) }) : t("The filter keeps two and hides Monash, the one its official page says he can apply to.");

  return (
    <section id="fine-print" aria-labelledby="fine-print-title" className="border-b bg-background">
      <div className="home-wrap flex flex-col gap-10 py-16 lg:py-24">
        <SectionHead
          id="fine-print-title"
          index="03"
          eyebrow={t("Fine print")}
          title={t("A filter says yes. The official page says no.")}
          lede={t("Here is what a filter gives Arjun. He studies UCD’s finance top-up at Kaplan on a Student’s Pass. Drag the handle to compare the two answers.")}
        />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-heading font-bold text-white">
                A
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{t("Arjun · example student")}</span>
                <span className="text-sm text-muted-foreground">
                  {t.rich(
                    "UCD finance top-up at Kaplan · Student’s Pass · up to <b>{budget}</b> a year",
                    {
                      b: () => (
                        <InlineNumber
                          value={budget}
                          onChange={(n) => {
                            setBudget(n);
                            toast.add({ title: t("Arjun’s budget is now {budget}", { budget: money(n) }), description: t("The filter’s answers changed. The official pages’ didn’t.") });
                          }}
                          format={money}
                          label={t("Arjun’s yearly budget")}
                          min={5000}
                          max={200000}
                        />
                      ),
                    },
                    { budget: money(budget) },
                  )}
                </span>
              </div>
            </div>
            <Segmented
              size="sm"
              label={t("Show")}
              value={view}
              options={[
                { value: "filter", label: t("Filter") },
                { value: "split", label: t("Both") },
                { value: "official", label: t("Official page") },
              ]}
              onChange={(v) => go(v === "filter" ? 100 : v === "official" ? 0 : half)}
            />
          </div>

          <motion.div style={{ "--split": splitPct } as React.CSSProperties} className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            <div className="grid grid-cols-2 border-b text-[0.72rem] font-semibold tracking-[0.1em] uppercase">
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 text-muted-foreground">
                <FilterIcon aria-hidden className="size-3.5" />
                <span className="sm:hidden">{t("Filter")}</span>
                <span className="hidden sm:inline">{t("What a filter shows")}</span>
              </span>
              <span className="inline-flex items-center justify-end gap-1.5 px-4 py-2.5 text-primary">
                <span className="sm:hidden">{t("Official page")}</span>
                <span className="hidden sm:inline">{t("What the official page says")}</span>
                <BadgeCheckIcon aria-hidden className="size-3.5" />
              </span>
            </div>
            <div
              ref={area}
              className="relative cursor-ew-resize touch-pan-y select-none"
              onPointerDown={(e) => {
                // Not from a receipt preview (a portal, whose events React passes up to here).
                if (!e.currentTarget.contains(e.target as Node)) return;
                if ((e.target as HTMLElement).closest("a,button,[role=slider]")) return;
                if (e.pointerType !== "mouse") return;
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                fromPointer(e.clientX);
              }}
              onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
            >
              <ul className="divide-y">
                {rows.map(({ row, verdict, detail }) => (
                  <Row key={row.id} row={row} filterVerdict={verdict} detail={detail} university={names.school(row.university).name} />
                ))}
              </ul>
              {/* The wipe: a line and a handle at the split. */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-(--split) w-0.5 -translate-x-1/2 bg-primary" />
              <div
                role="slider"
                tabIndex={0}
                aria-label={t("Drag to compare the filter with the official page")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                aria-valuetext={t("{n}% filter, {m}% official page", { n: value, m: 100 - value })}
                onPointerDown={(e) => {
                  dragging.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
                onPointerUp={() => (dragging.current = false)}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 20 : 5;
                  const v = split.get();
                  const to =
                    e.key === "ArrowLeft" || e.key === "ArrowDown"
                      ? v - step
                      : e.key === "ArrowRight" || e.key === "ArrowUp"
                        ? v + step
                        : e.key === "PageDown"
                          ? v - 20
                          : e.key === "PageUp"
                            ? v + 20
                            : e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? 100
                                : null;
                  if (to === null) return;
                  e.preventDefault();
                  split.set(Math.min(100, Math.max(0, to)));
                }}
                className="absolute top-1/2 left-(--split) z-10 grid size-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background outline-none focus-visible:ring-ring/60"
              >
                <ChevronsLeftRightIcon aria-hidden className="size-4" />
              </div>
            </div>
          </motion.div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="max-w-2xl text-sm text-muted-foreground text-pretty">
              {summary} {t("Kaplan 360++ shows the sentence behind every answer.")}
              <span className="block pt-1 text-xs">{t("Fees in S$ are approximate, at the MAS rate for Sep 2026 (A$1 = S${rate}).", { rate: AUD_SGD })}</span>
            </p>
            <ReceiptChip ids={FINE_PRINT.map((r) => r.official.receipt)} title={t("Arjun’s three programmes")} label={t("All three receipts")} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** One programme: the filter's answer and the official page's, stacked in the same place, each showing on its side of the split. */
function Row({ row, filterVerdict, detail, university }: { row: FinePrintRow; filterVerdict: Verdict; detail: string; university: string }) {
  const t = useT();
  const local = useLocalName();
  const title = local(row.programme, row.zh);
  const FilterIcon = ICON[filterVerdict];
  const OfficialIcon = ICON[row.official.verdict];
  const where = [university, row.campus ? t(row.campus) : null].filter(Boolean).join(" · ");
  const name = (
    <div className="min-w-0">
      <p className="truncate font-medium" lang={title.en ? undefined : "en"}>
        {title.name}
      </p>
      {/* On the Chinese pages the English name stays below the Chinese one (applications use it). */}
      {title.en && (
        <p className="truncate text-xs text-muted-foreground" lang="en">
          {title.en}
        </p>
      )}
      <p className="truncate text-xs text-muted-foreground">{where}</p>
    </div>
  );
  return (
    <li className="grid">
      {/* The filter's view, shown left of the split. */}
      <div className="col-start-1 row-start-1 grid grid-cols-2 gap-x-6 bg-muted/70 p-4 [clip-path:inset(0_calc(100%_-_var(--split))_0_0)] sm:p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <VerdictBadge verdict={filterVerdict}>
            <FilterIcon aria-hidden className="size-3.5" />
            <span className="sr-only">{t("A filter says:")}</span>
            {filterVerdict === "meets" ? t("Match") : t("Hidden")}
          </VerdictBadge>
          {name}
        </div>
        <p className="self-center text-sm text-muted-foreground">{detail}</p>
      </div>
      {/* The official page's, shown right of it. */}
      <div className="col-start-1 row-start-1 grid grid-cols-2 gap-x-6 bg-card p-4 [clip-path:inset(0_0_0_var(--split))] sm:p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <VerdictBadge verdict={row.official.verdict}>
            <OfficialIcon aria-hidden className="size-3.5" />
            <span className="sr-only">{t("The official page says:")}</span>
            {t(row.official.label)}
          </VerdictBadge>
          {name}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2 self-center">
          <p className="text-sm leading-relaxed font-medium text-pretty">
            <Quote text={row.official.quote} mark={row.official.mark} />
          </p>
          <ReceiptChip ids={[row.official.receipt]} title={`${title.name}, ${university}`} />
        </div>
      </div>
    </li>
  );
}
