"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BotIcon, ChevronDownIcon, CircleHelpIcon, HighlighterIcon, RotateCcwIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/workspace/spinner";
import type { Mark, MarkKind, ReviewResult } from "@/lib/adviser/types";
import { msg } from "@/lib/i18n/translate";
import { cn } from "cn";
import { Feed } from "./feed";
import type { ErrorCode } from "./transport";
import type { FeedItem } from "./use-adviser";

// Kappy's reading of the three plans (Step 4 of the AI adviser v2): the model's paragraphs with the passages it chose
// to highlight, each with the reason it gave; its live reasoning summary while it reads, kept behind a toggle after;
// the one question it says only the student can answer; and the model's name, so the student knows which LLM wrote it.
// The page draws the highlights in one by one when the reading lands, in the order the model listed them.

const KIND: Record<MarkKind, { label: string; mark: string; note: string }> = {
  key: { label: msg("What weighs most"), mark: "from-amber-300/70 to-amber-300/70 border-amber-500 dark:from-amber-400/30 dark:to-amber-400/30", note: "border-amber-500 bg-amber-500/10" },
  risk: { label: msg("What goes wrong if a condition fails"), mark: "from-rose-300/60 to-rose-300/60 border-rose-500 dark:from-rose-400/30 dark:to-rose-400/30", note: "border-rose-500 bg-rose-500/10" },
  check: { label: msg("Check on the official page first"), mark: "from-sky-300/60 to-sky-300/60 border-sky-500 dark:from-sky-400/30 dark:to-sky-400/30", note: "border-sky-500 bg-sky-500/10" },
};

type Placed = { mark: Mark; n: number; start: number; end: number };

/** Where each mark sits in its paragraph: first occurrence, no overlaps, in text order. A quote not found is dropped. */
function place(text: string, marks: Mark[], first: number): Placed[] {
  const out: Placed[] = [];
  for (const mark of marks) {
    let from = 0;
    for (;;) {
      const start = text.indexOf(mark.quote, from);
      if (start < 0) break;
      const end = start + mark.quote.length;
      if (!out.some((p) => start < p.end && end > p.start)) {
        out.push({ mark, n: 0, start, end });
        break;
      }
      from = start + 1;
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out.map((p, i) => ({ ...p, n: first + i + 1 }));
}

function Paragraph({ text, placed, shown, active, onToggle }: { text: string; placed: Placed[]; shown: number; active: number | null; onToggle: (n: number) => void }) {
  const t = useT();
  const parts: ReactNode[] = [];
  let at = 0;
  for (const p of placed) {
    if (p.start > at) parts.push(text.slice(at, p.start));
    const k = KIND[p.mark.kind];
    parts.push(
      <button
        key={p.n}
        type="button"
        style={{ font: "inherit", backgroundSize: p.n <= shown ? "100% 100%" : "0% 100%", borderBottomWidth: p.n <= shown ? 2 : 0 }}
        aria-expanded={active === p.n}
        aria-label={t("Highlight {n}, {kind}: {quote}", { n: p.n, kind: t(k.label), quote: p.mark.quote })}
        className={cn(
          "m-0 inline cursor-pointer appearance-none rounded-sm border-0 border-solid bg-transparent bg-linear-to-r bg-left bg-no-repeat p-0 px-0.5 text-left text-inherit box-decoration-clone transition-[background-size] duration-500 motion-reduce:transition-none",
          k.mark,
          active === p.n && "outline-2 outline-offset-2 outline-primary",
        )}
        onClick={() => onToggle(p.n)}
      >
        {p.mark.quote}
        <sup className="ml-0.5 text-[10px] font-semibold text-muted-foreground">{p.n}</sup>
      </button>,
    );
    at = p.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  const open = placed.find((p) => p.n === active);
  return (
    <div>
      <p className="text-[15px] leading-relaxed">{parts}</p>
      {open && (
        <p className={cn("mt-1.5 rounded-md border-l-2 px-2.5 py-1.5 text-sm", KIND[open.mark.kind].note)} role="note">
          <span className="font-semibold">{t("Why Kappy marked this")}: </span>
          {open.mark.why}
        </p>
      )}
    </div>
  );
}

type Props = {
  review: ReviewResult | null;
  reviewing: boolean;
  feed: FeedItem[];
  error: ErrorCode | null;
  onRetry: () => void;
  demo: boolean;
};

export function KappyRead({ review, reviewing, feed, error, onRetry, demo }: Props) {
  const t = useT();
  const [active, setActive] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [reasoning, setReasoning] = useState(false);

  // Marks are drawn in one at a time once the reading lands; a new reading starts over.
  const placed: Placed[][] = [];
  let count = 0;
  for (const p of review?.paragraphs ?? []) {
    const here = place(p.text, p.marks, count);
    placed.push(here);
    count += here.length;
  }
  // A new reading starts the draw-in over (state adjusted during render), then the interval reveals a mark at a time.
  const [seen, setSeen] = useState(review);
  if (seen !== review) {
    setSeen(review);
    setShown(0);
    setActive(null);
  }
  useEffect(() => {
    if (!review) return;
    const total = review.paragraphs.reduce((n, p) => n + p.marks.length, 0);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(i);
      if (i >= total) window.clearInterval(id);
    }, 380);
    return () => window.clearInterval(id);
  }, [review]);

  const counts = { key: 0, risk: 0, check: 0 } as Record<MarkKind, number>;
  for (const list of placed) for (const p of list) counts[p.mark.kind]++;
  const thinking = feed.filter((i) => i.kind === "thinking");

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="kappy-read">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 id="kappy-read" className="flex items-center gap-1.5 text-sm font-semibold">
          <HighlighterIcon className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
          {t("Kappy’s read of the three plans")}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground" title={t("The large language model that wrote this")}>
          <BotIcon className="size-3" aria-hidden />
          {reviewing ? t("LLM at work") : review ? review.model : t("LLM")}
        </span>
        {(thinking.length > 0 || reviewing) && (
          <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline" aria-expanded={reasoning || reviewing} onClick={() => setReasoning((v) => !v)}>
            <ChevronDownIcon className={cn("size-3.5 transition-transform", (reasoning || reviewing) && "rotate-180")} aria-hidden />
            {reviewing ? t("Kappy’s reasoning, as it reads") : reasoning ? t("Hide Kappy’s reasoning") : t("Show Kappy’s reasoning")}
          </button>
        )}
      </div>

      {(reviewing || reasoning) && (
        <div className="mb-3 rounded-lg border border-dashed bg-muted/40 p-3">
          {reviewing && (
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground" role="status">
              <Spinner className="size-3.5" />
              {t("A reasoning summary, streamed from the model while it reads")}
            </p>
          )}
          {thinking.length ? <Feed items={thinking} /> : <p className="text-xs text-muted-foreground italic">{t("Waiting for the first words…")}</p>}
        </div>
      )}

      {error && !reviewing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          <span className="text-destructive">{t("Kappy couldn’t finish reading the plans.")}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcwIcon aria-hidden />
            {t("Read them again")}
          </Button>
        </div>
      )}

      {review && (
        <div className="space-y-3">
          {review.paragraphs.map((p, i) => (
            <Paragraph key={i} text={p.text} placed={placed[i]} shown={shown} active={active} onToggle={(n) => setActive((a) => (a === n ? null : n))} />
          ))}

          {count > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t("What the highlights mean")}>
              {(Object.keys(KIND) as MarkKind[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-3 w-5 rounded-sm border-0 border-b-2 border-solid bg-linear-to-r", KIND[k].mark)} aria-hidden />
                  {t(KIND[k].label)}
                  <span className="tabular-nums">({counts[k]})</span>
                </li>
              ))}
            </ul>
          )}

          {review.question && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
              <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="leading-snug">
                <span className="font-semibold">{t("Only you can answer this")}: </span>
                {review.question}
              </p>
            </div>
          )}

          <p className="text-xs leading-snug text-muted-foreground">
            {demo
              ? t("Demo reading: no model was called for this step.")
              : t("You are reading a large language model, {model}. The highlights are its own choice, not a rule: it was asked to mark 3 to 6 passages of its text and to say why. Tap a highlight for its reason. Every number went through the same check as the decision above.", { model: review.model })}
          </p>
        </div>
      )}
    </section>
  );
}
