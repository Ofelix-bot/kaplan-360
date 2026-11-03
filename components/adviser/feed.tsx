"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { KappyIcon } from "@/components/kappy/Kappy";
import { cn } from "cn";
import s from "./adviser.module.css";
import { TOOL_ICON } from "./adviser-kappy";
import type { FeedItem } from "./use-adviser";

// One agent's live feed (AI adviser v2): its thinking as one muted line that grows, and one row per tool it ran: the
// lookup's pixel icon from Kappy's chest screen in its lane's colour, what it found over the tool's name, how many
// official sources and how long.

/** A blinking square: something is under way (the spinner, in Kappy's pixels). */
export function Blink({ className }: { className?: string }) {
  return <span className={cn(s.blink, className)} aria-hidden />;
}

export function SourceCount({ n }: { n: number }) {
  const t = useT();
  if (!n) return null;
  return (
    <span className={s.sources} title={t("{n} official sources", { n })}>
      {n}
    </span>
  );
}

export function Feed({ items, className }: { items: FeedItem[]; className?: string }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <ul className={cn(s.feed, className)}>
      {items.map((it) => {
        if (it.kind === "thinking") {
          const text = it.text.length > 320 ? `…${it.text.slice(-320)}` : it.text;
          return (
            <li key={it.key} className={s.think}>
              {text}
            </li>
          );
        }
        const e = it.event;
        return (
          <li key={it.key} className={s.tool}>
            <KappyIcon name={TOOL_ICON[e.tool] ?? "chart"} className={cn(s.ico, e.status === "error" ? s.err : e.lane === "career" ? s.car : s.edu)} />
            <span className="min-w-0">
              <code>{e.tool}</code>
              {e.summary}
            </span>
            <span className={s.src}>
              {e.sources > 0 && <span title={t("{n} official sources", { n: e.sources })}>{e.sources === 1 ? t("1 source") : t("{n} sources", { n: e.sources })}</span>}
              {e.ms > 0 && <span>{(e.ms / 1000).toFixed(1)} s</span>}
              {e.status === "error" && <span className={s.err}>×</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
