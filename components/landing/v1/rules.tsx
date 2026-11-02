"use client";

import { useEffect, useRef } from "react";
import {
  Building2Icon,
  BriefcaseBusinessIcon,
  CalendarX2Icon,
  CheckIcon,
  CoinsIcon,
  CopyIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  LandmarkIcon,
  MaximizeIcon,
  ReceiptTextIcon,
  SchoolIcon,
  ShieldXIcon,
  SquareDashedMousePointerIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogBackdrop, DialogClose, DialogDescription, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { RULES, type Residency, type Rule, type RuleFigure, type RuleIcon, type Verdict } from "@/lib/home/content";
import { receiptsOf } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import { msg, type T } from "@/lib/i18n/translate";
import { Count } from "./count";
import { ReceiptCard, ReceiptChip } from "../receipts";
import { SectionHead } from "./section-head";
import { useSpotlight } from "./spotlight";
import { useMarquee } from "./use-marquee";

// 02 Hidden rules: what the official pages say and the brochures don't, as cards. A card opens into
// a dialog that grows out of it (the card's own outline morphs), with every receipt in full. Right-
// click (or long-press) a card for its menu; drag a box from an empty spot, or Ctrl/⌘-click, to pick
// several and copy them or read all their receipts at once.

const ICONS: Record<RuleIcon, typeof TrendingUpIcon> = {
  trending: TrendingUpIcon,
  briefcase: BriefcaseBusinessIcon,
  "calendar-x": CalendarX2Icon,
  shield: ShieldXIcon,
  building: Building2Icon,
  graduation: GraduationCapIcon,
  landmark: LandmarkIcon,
  school: SchoolIcon,
  coins: CoinsIcon,
};

const NUMBER_WORDS = [msg("Zero"), msg("One"), msg("Two"), msg("Three"), msg("Four"), msg("Five"), msg("Six"), msg("Seven"), msg("Eight"), msg("Nine"), msg("Ten")];

export const VERDICT: Record<Verdict, string> = {
  meets: "bg-success/12 text-success",
  fails: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  check: "bg-info/12 text-info",
  neutral: "bg-muted text-muted-foreground",
};

export function VerdictBadge({ verdict, children, className }: { verdict: Verdict; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 w-fit items-center gap-1 rounded-full px-2.5 text-[0.8rem] font-medium", VERDICT[verdict], className)}>{children}</span>;
}

/** A rule as plain text, for the clipboard: title, what it says, and its sources. */
function ruleText(rule: Rule, t: T) {
  const sources = receiptsOf(rule.receipts).map((r) => r.url);
  return [`${t(rule.title)}`, t(rule.body), ...sources.map((u) => `${t("Source")}: ${u}`)].join("\n");
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Rules({ residency }: { residency: Residency }) {
  const t = useT();
  const reduce = useReducedMotion();
  const selected = useHome((s) => s.selected);
  const setSelected = useHome((s) => s.setSelected);
  const openRule = useHome((s) => s.openRule);
  const setOpenRule = useHome((s) => s.setOpenRule);
  const showReceipts = useHome((s) => s.showReceipts);
  const { area, box, handlers } = useMarquee({ selected, onSelect: setSelected });
  const rules = RULES.filter((r) => r.audience.includes(residency));
  const units = rules.reduce((n, r) => n + (r.wide ? 2 : 1), 0);
  const picked = rules.filter((r) => selected.includes(r.id));
  const open = RULES.find((r) => r.id === openRule) ?? null;

  // A rule that left the list (the other residency) leaves the selection too; Escape clears it.
  useEffect(() => {
    const keep = selected.filter((id) => rules.some((r) => r.id === id));
    if (keep.length !== selected.length) setSelected(keep);
  }, [residency]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selected.length) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !openRule && setSelected([]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.length, openRule, setSelected]);

  const copyRules = async (list: Rule[]) => {
    const ok = await copy(list.map((r) => ruleText(r, t)).join("\n\n"));
    toast.add(ok ? { title: list.length === 1 ? t("Rule copied") : t("{n} rules copied", { n: list.length }), description: t("With the official page behind each one.") } : { title: t("Couldn’t copy"), description: t("Your browser blocked the clipboard.") });
  };

  return (
    <section
      id="rules"
      aria-labelledby="rules-title"
      ref={area as React.RefObject<HTMLElement>}
      {...handlers}
      className="relative border-b bg-muted/60"
    >
      <div className="home-wrap flex flex-col gap-10 py-16 lg:py-24">
        <SectionHead
          id="rules-title"
          index="02"
          eyebrow={t("Hidden rules")}
          title={t("{n} rules nobody puts in the brochure.", { n: t(NUMBER_WORDS[rules.length] ?? String(rules.length)) })}
          lede={t("Each one sits on an official page. Open a rule to read the sentence it comes from.")}
        >
          <p className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <SquareDashedMousePointerIcon aria-hidden className="size-4" />
            {t("Drag across the cards from an empty spot to pick several, or Ctrl/⌘-click. Right-click a card for more.")}
          </p>
        </SectionHead>

        <LayoutGroup>
          <motion.ul layout={!reduce} className={cn("grid gap-4 md:grid-cols-2", residency === "student-pass" ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
            <AnimatePresence initial={false} mode="popLayout">
              {rules.map((rule, i) => (
                <motion.li
                  key={rule.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 32 }}
                  className={cn("min-w-0", rule.wide && "md:col-span-2", i === rules.length - 1 && units % 2 === 1 && "md:col-span-2 lg:col-span-1")}
                >
                  <RuleCard rule={rule} onCopy={() => copyRules([rule])} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
          <RuleDialog rule={open} onClose={() => setOpenRule(null)} onCopy={(r) => copyRules([r])} />
        </LayoutGroup>
      </div>

      {box && <div aria-hidden className="pointer-events-none absolute z-20 rounded-md border border-primary/70 bg-primary/10" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}

      <AnimatePresence>
        {picked.length > 0 && (
          <motion.div
            role="region"
            aria-label={t("Selected rules")}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            data-no-marquee
            className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-full bg-foreground p-1.5 pl-4 text-sm text-background shadow-xl sm:bottom-24"
          >
            <span className="mr-2 font-medium tabular-nums" aria-live="polite">
              {t(picked.length === 1 ? "1 rule picked" : "{n} rules picked", { n: picked.length })}
            </span>
            <button type="button" onClick={() => copyRules(picked)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium hover:bg-background/15">
              <CopyIcon aria-hidden className="size-4" />
              {t("Copy as a list")}
            </button>
            <button
              type="button"
              onClick={() => showReceipts([...new Set(picked.flatMap((r) => r.receipts))], t("{n} rules", { n: picked.length }))}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium hover:bg-background/15"
            >
              <ReceiptTextIcon aria-hidden className="size-4" />
              {t("All their receipts")}
            </button>
            <button type="button" aria-label={t("Clear the selection")} onClick={() => setSelected([])} className="grid size-8 place-items-center rounded-full hover:bg-background/15">
              <XIcon aria-hidden className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function RuleCard({ rule, onCopy }: { rule: Rule; onCopy: () => void }) {
  const t = useT();
  const selected = useHome((s) => s.selected.includes(rule.id));
  const anySelected = useHome((s) => s.selected.length > 0);
  const toggle = useHome((s) => s.toggleSelected);
  const setOpenRule = useHome((s) => s.setOpenRule);
  const showReceipts = useHome((s) => s.showReceipts);
  const spot = useSpotlight();
  const Icon = ICONS[rule.icon];
  const official = receiptsOf(rule.receipts).find((r) => r.kind === "official");

  return (
    <ContextMenu>
      <ContextMenuTrigger
        data-select-id={rule.id}
        className="group/card relative h-full rounded-2xl"
        onPointerMove={spot.onPointerMove}
        onPointerLeave={spot.onPointerLeave}
      >
        <motion.article
          layoutId={`rule-${rule.id}`}
          transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
          className={cn(
            "relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 transition-shadow duration-200",
            selected ? "ring-2 ring-primary" : "ring-foreground/10 hover:ring-foreground/20",
          )}
        >
          {spot.overlay}
          <div className="flex flex-col gap-3 px-5 pt-5">
            <div className="flex items-center justify-between gap-2">
              <motion.span layout="position" layoutId={`rule-tag-${rule.id}`} className="inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                <Icon aria-hidden className="size-3.5 text-primary" />
                {t(rule.tag)}
              </motion.span>
              <label
                className={cn(
                  "relative z-10 grid size-6 cursor-pointer place-items-center rounded-md border transition-opacity",
                  selected ? "border-primary bg-primary text-primary-foreground opacity-100" : cn("border-foreground/25 bg-background", anySelected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100 focus-within:opacity-100"),
                )}
              >
                <input type="checkbox" checked={selected} onChange={() => toggle(rule.id)} className="peer sr-only" aria-label={t("Pick “{title}”", { title: t(rule.title) })} />
                {selected && <CheckIcon aria-hidden className="size-3.5" />}
                <span aria-hidden className="absolute inset-0 rounded-md peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50" />
              </label>
            </div>
            <motion.h3 layout="position" layoutId={`rule-title-${rule.id}`} className="font-heading text-lg leading-snug font-semibold tracking-tight text-balance">
              {/* The whole card opens the rule; Ctrl/⌘ or Shift picks it instead. */}
              <button
                type="button"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) toggle(rule.id);
                  else setOpenRule(rule.id);
                }}
                className="text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {t(rule.title)}
              </button>
            </motion.h3>
          </div>
          <div className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-5">
            <Figure figure={rule.figure} />
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{t(rule.body)}</p>
          </div>
          <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t bg-muted/50 px-5 py-3">
            <ReceiptChip ids={rule.receipts} title={t(rule.title)} />
            <span className="hidden items-center gap-1 text-xs text-muted-foreground group-hover/card:inline-flex">
              <MaximizeIcon aria-hidden className="size-3.5" />
              {t("Open")}
            </span>
          </div>
        </motion.article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setOpenRule(rule.id)}>
          <MaximizeIcon />
          {t("Open this rule")}
          <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => showReceipts(rule.receipts, t(rule.title))}>
          <ReceiptTextIcon />
          {t("Show the receipts")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopy}>
          <CopyIcon />
          {t("Copy the rule")}
        </ContextMenuItem>
        {official && (
          <ContextMenuItem onClick={() => window.open(official.url, "_blank", "noopener,noreferrer")}>
            <ExternalLinkIcon />
            {t("Open the official page")}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => toggle(rule.id)}>
          <SquareDashedMousePointerIcon />
          {selected ? t("Unpick") : t("Pick")}
          <ContextMenuShortcut>{t("Ctrl-click")}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** The rule, grown out of its card: the same outline morphs into the dialog, with each receipt in full. */
function RuleDialog({ rule, onClose, onCopy }: { rule: Rule | null; onClose: () => void; onCopy: (r: Rule) => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  // AnimatePresence keeps the last rendering while the dialog closes, so `shown` is only read while open.
  const shown = rule;
  const Icon = shown ? ICONS[shown.icon] : null;
  return (
    <Dialog open={!!rule} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {shown && Icon && (
          <DialogPortal keepMounted>
            <DialogBackdrop
              render={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />}
            />
            <DialogViewport>
              <DialogPopup
                className="max-w-2xl overflow-hidden"
                render={
                  <motion.div
                    layoutId={reduce ? undefined : `rule-${shown.id}`}
                    initial={reduce ? { opacity: 0 } : undefined}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { opacity: { duration: 0.15, delay: 0.18 } } }}
                    transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
                  />
                }
              >
                <div className="flex flex-col gap-4 p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <motion.span layout="position" layoutId={reduce ? undefined : `rule-tag-${shown.id}`} className="inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                      <Icon aria-hidden className="size-3.5 text-primary" />
                      {t(shown.tag)}
                    </motion.span>
                    <DialogClose aria-label={t("Close")} className="-mt-1 -mr-2 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <XIcon aria-hidden className="size-4" />
                    </DialogClose>
                  </div>
                  <DialogTitle render={<motion.h3 layout="position" layoutId={reduce ? undefined : `rule-title-${shown.id}`} />} className="text-2xl tracking-tight text-balance sm:text-[1.7rem]">
                    {t(shown.title)}
                  </DialogTitle>
                  <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: reduce ? 0 : 0.12, ease: [0.23, 1, 0.32, 1] }} className="flex flex-col gap-5">
                    <Figure figure={shown.figure} large />
                    <DialogDescription className="text-base leading-relaxed text-pretty">{t(shown.body)}</DialogDescription>
                    <div className="flex flex-col gap-3">
                      <p className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{t(receiptsOf(shown.receipts).length === 1 ? "The receipt" : "The receipts")}</p>
                      {receiptsOf(shown.receipts).map((r, i) => (
                        <ReceiptCard key={r.id} receipt={r} index={i} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onCopy(shown)}
                        className="inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <CopyIcon aria-hidden className="size-4" />
                        {t("Copy the rule")}
                      </button>
                    </div>
                  </motion.div>
                </div>
              </DialogPopup>
            </DialogViewport>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

/** Each rule's picture: salary bars, two figures side by side, the points ladder, or a verdict. */
function Figure({ figure, large = false }: { figure: RuleFigure; large?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const grow = (share: number, i: number) =>
    reduce ? { scaleX: share } : { scaleX: inView ? share : 0, transition: { duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.23, 1, 0.32, 1] as const } };

  switch (figure.type) {
    case "bars":
      return (
        <div ref={ref} className="flex flex-col gap-3">
          {figure.bars.map((b, i) => (
            <div key={b.label} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3">
              <span className="font-heading text-sm font-semibold tabular-nums">{b.display}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
                  <motion.div
                    className={cn("h-full origin-left rounded-full", b.tone === "muted" && "bg-[#8576e6]", b.tone === "warning" && "bg-amber", b.tone === "fails" && "bg-destructive")}
                    initial={{ scaleX: 0 }}
                    animate={grow(b.value / figure.max, i)}
                  />
                </div>
                <span className="text-xs text-muted-foreground text-pretty">{t(b.label)}</span>
              </div>
            </div>
          ))}
        </div>
      );
    case "versus": {
      const num = (v: string) => /^(\d+)(.*)$/.exec(t(v));
      const cell = (v: string, cls: string) => {
        const m = num(v);
        return m ? (
          <span className={cls}>
            <Count value={Number(m[1])} />
            {m[2]}
          </span>
        ) : (
          <span className={cls}>{t(v)}</span>
        );
      };
      return (
        <div ref={ref} className="grid grid-cols-2 overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <div className={cn("flex flex-col gap-1 p-3", figure.neutral ? "bg-muted" : "bg-destructive/8 dark:bg-destructive/15")}>
            {cell(figure.you.value, cn("font-heading font-bold tracking-tight tabular-nums", large ? "text-4xl" : "text-3xl", figure.neutral ? "text-foreground" : "text-destructive"))}
            <span className="text-xs text-muted-foreground">{t(figure.you.label)}</span>
          </div>
          <div className="flex flex-col gap-1 bg-card p-3">
            {cell(figure.them.value, cn("font-heading font-bold tracking-tight text-muted-foreground tabular-nums", large ? "text-4xl" : "text-3xl"))}
            <span className="text-xs text-muted-foreground">{t(figure.them.label)}</span>
          </div>
        </div>
      );
    }
    case "ladder":
      return (
        <div ref={ref} className="flex flex-col gap-2">
          <ol className="grid grid-cols-3 gap-2">
            {figure.steps.map((s, i) => (
              <li
                key={s.label}
                className={cn("flex flex-col justify-end gap-1.5 rounded-xl p-3 ring-1 ring-foreground/10", i === 0 && "bg-destructive/8 dark:bg-destructive/15", i === 1 && "bg-card", i === 2 && "bg-success/12")}
                style={{ minHeight: `${(large ? 6 : 5) + i * 1.5}rem` }}
              >
                <span className={cn("font-heading text-3xl font-bold tabular-nums", i === 0 && "text-destructive", i === 2 && "text-success")}>
                  <Count value={s.points} />
                </span>
                {/* Each tier's share of the 40 points COMPASS needs. */}
                <span className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <motion.span className={cn("block h-full origin-left rounded-full", i === 0 ? "bg-destructive" : i === 1 ? "bg-foreground/50" : "bg-success")} initial={{ scaleX: 0 }} animate={grow(s.points / figure.need, i)} />
                </span>
                <span className="text-xs leading-snug text-muted-foreground">{t(s.label)}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">{t("Bars show each tier’s share of the {n} points an application needs.", { n: figure.need })}</p>
        </div>
      );
    case "verdict":
      return (
        <div ref={ref}>
          <VerdictBadge verdict={figure.verdict}>{t(figure.label)}</VerdictBadge>
        </div>
      );
  }
}
