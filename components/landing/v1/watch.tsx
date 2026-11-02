"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  FileSearchIcon,
  FileTextIcon,
  ListChecksIcon,
  ScanTextIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserRoundSearchIcon,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { useSiteNames } from "@/components/i18n/site-names";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RULES_ON_THE_MOVE } from "@/lib/home/content";
import { receiptsFrom, SOURCES, type SourceId } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import { msg } from "@/lib/i18n/translate";
import { Count } from "./count";
import { Dock } from "./dock";
import { ReceiptGallery } from "./gallery";
import { ReceiptChip, useDay, useSourceName } from "../receipts";
import { SectionHead } from "./section-head";

// 05 Rule watch: the latest re-reading of the official pages (lib/changes.ts), as a stack of
// notifications that fans out under the pointer; how a number gets onto the page, step by step;
// the rule changes that matter most; every receipt on the page as a strip of photos to drag
// through; and the sources, as a dock.

export type WatchChange = {
  id: string;
  change: "added" | "removed" | "deadline" | "next-deadline" | "date" | "value";
  university: string;
  title: string;
  from: string | null;
  to: string | null;
  url: string;
  /** A run of changes of one kind from one place, shown as one notification. */
  batch?: { n: number; first: string | null; last: string | null };
};

export type WatchData = { checked: string; since: string; sinceLatest?: string; pages: number; total: number; changes: WatchChange[] };

const TAG: Record<WatchChange["change"], { label: string; className: string }> = {
  added: { label: msg("Newly listed"), className: "bg-success/12 text-success" },
  removed: { label: msg("No longer listed"), className: "bg-muted text-muted-foreground" },
  deadline: { label: msg("Deadline changed"), className: "bg-amber/25 text-amber-ink" },
  "next-deadline": { label: msg("Next deadline"), className: "bg-amber/25 text-amber-ink" },
  date: { label: msg("Date changed"), className: "bg-amber/25 text-amber-ink" },
  value: { label: msg("Value changed"), className: "bg-info/12 text-info" },
};

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function Watch({ data }: { data: WatchData }) {
  const t = useT();
  const day = useDay();
  const source = useSourceName();
  const showReceipts = useHome((s) => s.showReceipts);
  const locale = useIntlLocale();
  // "18–19 Oct 2026", as on /benefits; Chinese ranges are written out like single dates.
  const span = (a: string, b?: string) =>
    !b || b === a
      ? day(a)
      : locale.startsWith("zh")
        ? `${day(a)}至${a.slice(0, 4) === b.slice(0, 4) ? day(b).replace(/^\d{4}年/, "") : day(b)}`
        : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).formatRange(new Date(`${a}T00:00:00`), new Date(`${b}T00:00:00`));
  const since = span(data.since, data.sinceLatest);
  const dock = (Object.keys(SOURCES) as SourceId[]).map((id) => {
    const n = receiptsFrom(id).length;
    const { name } = source(id);
    return { id, label: name, monogram: SOURCES[id].mono, caption: t(n === 1 ? "1 receipt" : "{n} receipts", { n }), tone: SOURCES[id].kind };
  });

  return (
    <section id="watch" aria-labelledby="watch-title" className="relative overflow-hidden bg-brand text-white">
      <span aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-[#5b4fc4]/30 blur-3xl" />
      <div className="relative home-wrap flex flex-col gap-12 py-16 lg:py-24">
        <SectionHead
          id="watch-title"
          index="05"
          tone="brand"
          eyebrow={t("Rule watch")}
          title={t("The rules move. We keep reading them.")}
          lede={t.rich(
            "<n>{pages}</n> official pages were read again on {date} and compared with the reading of {since}. <n>{changes}</n> things changed.",
            { n: (c) => <span className="font-semibold text-white tabular-nums">{c}</span> },
            { pages: <Count value={data.pages} />, changes: <Count value={data.total} />, date: day(data.checked), since },
          )}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-lg font-semibold">{t("Changed this week")}</h3>
                <Link href="/benefits#changes" className="inline-flex items-center gap-1 text-sm font-medium text-amber hover:underline">
                  {t("All {n} changes", { n: data.total })}
                  <ArrowUpRightIcon aria-hidden className="size-3.5" />
                </Link>
              </div>
              <NotificationStack changes={data.changes} />
            </div>
            <Pipeline pages={data.pages} checked={day(data.checked)} />
          </div>
          <RulesOnTheMove />
        </div>

        <ReceiptGallery />

        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-white/70">{t("Where the receipts come from. Pick one to read everything from that source.")}</p>
          <Dock items={dock} onPick={(id) => showReceipts(receiptsFrom(id as SourceId).map((r) => r.id), source(id as SourceId).name)} />
        </div>
      </div>
    </section>
  );
}

/**
 * The week's changes as notifications: stacked, the newest in front, until the pointer comes over
 * them (or focus moves in, or the button is pressed); then they spread out into a list.
 */
function NotificationStack({ changes }: { changes: WatchChange[] }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover || !!reduce;
  // While stacked, the cards behind take the front card's height, so only their edges show.
  const front = useRef<HTMLDivElement>(null);
  const [frontHeight, setFrontHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = front.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrontHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="flex flex-col gap-3">
      <div
        // Room under the stack for the cards that peek out below the front one.
        className={cn("grid transition-[padding] duration-200", !open && changes.length > 1 && "pb-7")}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHover(false)}
      >
        {changes.map((c, i) => (
          <motion.div
            key={c.id}
            ref={i === 0 ? front : undefined}
            layout={!reduce}
            initial={false}
            animate={open ? { y: 0, scale: 1, opacity: 1 } : { y: i * 14, scale: 1 - i * 0.05, opacity: i < 3 ? 1 - i * 0.22 : 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            style={{ gridColumn: 1, gridRow: open ? i + 1 : 1, zIndex: changes.length - i, transformOrigin: "50% 0%", height: !open && i > 0 && frontHeight ? frontHeight : undefined }}
            className={cn("min-w-0", open && i > 0 && "mt-2", !open && i > 0 && "overflow-hidden rounded-2xl", !open && i >= 3 && "pointer-events-none")}
            aria-hidden={!open && i > 0 ? true : undefined}
          >
            <Notification change={c} interactive={open || i === 0} behind={!open && i > 0} />
          </motion.div>
        ))}
      </div>
      {!reduce && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setPinned((v) => !v)}
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform duration-200", pinned && "rotate-180")} />
          {pinned ? t("Stack them") : t("Show all {n}", { n: changes.length })}
        </button>
      )}
    </div>
  );
}

/** `behind`: a card under the front one while stacked, shown as an edge only. */
function Notification({ change: c, interactive, behind }: { change: WatchChange; interactive: boolean; behind: boolean }) {
  const t = useT();
  const day = useDay();
  const names = useSiteNames();
  const shown = (s: string | null) => (isDate(s) ? day(s) : s);
  const tag = TAG[c.change];
  const what = c.batch
    ? c.batch.first && c.batch.last
      ? t("{n} new dates, {span}", { n: c.batch.n, span: c.batch.first === c.batch.last ? day(c.batch.first) : `${day(c.batch.first)} – ${day(c.batch.last)}` })
      : t("{n} changes", { n: c.batch.n })
    : c.change === "added"
      ? shown(c.to)
      : c.change === "removed"
        ? null
        : `${shown(c.from) ?? "—"} → ${shown(c.to) ?? "—"}`;
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={interactive ? undefined : -1}
      className="group/n flex h-full items-start gap-3 rounded-2xl bg-card p-4 text-card-foreground shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)] outline-none focus-visible:ring-3 focus-visible:ring-amber"
    >
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1 transition-opacity duration-200", behind && "opacity-0")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[0.72rem] font-semibold", tag.className)}>{t(tag.label)}</span>
          <span className="truncate text-sm font-semibold">{names.school(c.university).name}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          <span lang="en">{c.batch ? t("Programme previews and events") : c.title}</span>
          {what && (
            <>
              {" · "}
              <span className="font-medium text-foreground tabular-nums">{what}</span>
            </>
          )}
        </p>
      </div>
      <ArrowUpRightIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover/n:translate-x-0.5 group-hover/n:-translate-y-0.5" />
      <span className="sr-only">({t("official page")})</span>
    </a>
  );
}

/** From reading a page to a number on this one: the steps, filled in as the section comes into view. */
function Pipeline({ pages, checked }: { pages: number; checked: string }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const reduce = useReducedMotion();
  const done = [
    { icon: FileSearchIcon, title: t("Read {n} official pages", { n: pages }), note: checked },
    { icon: ScanTextIcon, title: t("Picked out fees, entry requirements, deadlines and job openings") },
    { icon: ListChecksIcon, title: t("Matched every value word for word against its page") },
    { icon: Trash2Icon, title: t("Dropped anything the page doesn’t say") },
  ];
  const step = (i: number) => (reduce ? { opacity: 1, x: 0 } : { opacity: inView ? 1 : 0.35, x: 0, transition: { delay: 0.15 + i * 0.25, duration: 0.3 } });
  return (
    <div ref={ref} className="rounded-2xl bg-white/6 p-5 ring-1 ring-white/12 sm:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <ShieldCheckIcon aria-hidden className="size-5 text-amber" />
          {t("How every number gets here")}
        </h3>
        <p className="text-sm text-white/70">{t("Claude reads the pages. Nothing reaches you unless the page says it word for word, and pages a machine can’t read go to a person.")}</p>
      </div>
      <ol className="relative flex flex-col gap-3 pl-8">
        {/* The progress line: fills through the finished steps, dashed beyond them. */}
        <span aria-hidden className="absolute top-2 bottom-2 left-[0.6875rem] w-px bg-white/15" />
        <motion.span
          aria-hidden
          className="absolute top-2 left-[0.6875rem] w-px origin-top bg-amber"
          style={{ height: "calc(66% - 0.5rem)" }}
          initial={{ scaleY: reduce ? 1 : 0 }}
          animate={{ scaleY: inView || reduce ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.23, 1, 0.32, 1], delay: 0.15 }}
        />
        {done.map((s, i) => (
          <motion.li key={i} className="relative flex items-center gap-2 text-sm" initial={{ opacity: reduce ? 1 : 0.35 }} animate={step(i)}>
            <span className="absolute -left-8 grid size-6 place-items-center rounded-full bg-amber text-brand">
              <s.icon aria-hidden className="size-3.5" />
            </span>
            <span>{s.title}</span>
            {s.note && <span className="text-white/60 tabular-nums">{s.note}</span>}
          </motion.li>
        ))}
        <motion.li className="relative text-sm" initial={{ opacity: reduce ? 1 : 0.35 }} animate={step(4)}>
          <span className="absolute -left-8 grid size-6 place-items-center rounded-full bg-[#cdc6ff] text-brand">
            <UserRoundSearchIcon aria-hidden className="size-3.5" />
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#cdc6ff]/50 motion-reduce:hidden" />
          </span>
          <Collapsible>
            <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-md text-left outline-none hover:text-white focus-visible:ring-3 focus-visible:ring-amber/60">
              {t("Checking CSCSE notices by hand")}
              <ChevronDownIcon aria-hidden className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-2 border-l border-white/20 pl-3 text-white/75">
                {t.rich("China’s CSCSE site blocks automated reading, so a counsellor reads its notices on Singapore private schools and updates the recognition status. Until then those items show as <b>Checked by a person</b>.", {
                  b: (c) => <span className="font-medium text-[#cdc6ff]">{c}</span>,
                })}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </motion.li>
        <motion.li className="relative flex items-center gap-2 text-sm text-white/60" initial={{ opacity: reduce ? 1 : 0.35 }} animate={step(5)}>
          <span className="absolute -left-8 grid size-6 place-items-center rounded-full border border-dashed border-white/40">
            <CircleDashedIcon aria-hidden className="size-3.5" />
          </span>
          {t("Next full read")}
          <span className="text-white/45">{t("planned, about a week after the last")}</span>
        </motion.li>
      </ol>
    </div>
  );
}

/** Rule changes that decide who can stay, work or be recognised, newest first, the coming one marked. */
function RulesOnTheMove() {
  const t = useT();
  const day = useDay();
  const locale = useIntlLocale();
  return (
    <div className="rounded-2xl bg-card p-5 text-card-foreground shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)] sm:p-6 lg:sticky lg:top-24">
      <h3 className="font-heading text-lg font-semibold">{t("Rules on the move")}</h3>
      <p className="mb-5 text-sm text-muted-foreground">{t("Changes that decide who can stay, work or be recognised.")}</p>
      <ol className="relative flex flex-col gap-5 border-l pl-5">
        {RULES_ON_THE_MOVE.map((r) => (
          <li key={r.title} className="relative flex flex-col gap-1.5">
            <span aria-hidden className={cn("absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-card", r.ahead ? "bg-amber" : "bg-muted-foreground/40")} />
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {r.date.length === 7 ? new Date(`${r.date}-01T00:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" }) : day(r.date)}
              {r.ahead && <span className="ml-2 font-semibold text-amber-ink">{t("Coming up")}</span>}
            </span>
            <span className="text-sm font-medium text-pretty">{t(r.title)}</span>
            <ReceiptChip ids={r.receipts} title={t(r.title)} />
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <FileTextIcon aria-hidden className="size-3.5" />
        {t("Reports of a notice are marked as reports, not as the notice.")}
      </p>
    </div>
  );
}

