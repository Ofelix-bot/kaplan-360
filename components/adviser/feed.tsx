"use client";

import { BriefcaseIcon, CheckIcon, FileTextIcon, GraduationCapIcon, UserIcon, XIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { cn } from "cn";
import type { FeedItem } from "./use-adviser";

// One agent's live feed (AI adviser v2): its thinking as one grey line that grows, and one row per tool it ran
// (lane icon, what it found, how many official sources, how long).

const LANE_ICON = { education: GraduationCapIcon, career: BriefcaseIcon, you: UserIcon } as const;

export function SourceCount({ n }: { n: number }) {
  const t = useT();
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[11px] text-muted-foreground tabular-nums" title={t("{n} official sources", { n })}>
      <FileTextIcon className="size-3" aria-hidden />
      {n}
    </span>
  );
}

export function Feed({ items, className }: { items: FeedItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((it) => {
        if (it.kind === "thinking") {
          const text = it.text.length > 320 ? `…${it.text.slice(-320)}` : it.text;
          return (
            <li key={it.key} className="text-xs leading-snug text-muted-foreground italic">
              {text}
            </li>
          );
        }
        const e = it.event;
        const Icon = LANE_ICON[e.lane] ?? UserIcon;
        return (
          <li key={it.key} className="flex items-start gap-2 text-sm">
            <Icon className={cn("mt-0.5 size-3.5 shrink-0", e.lane === "career" ? "text-amber-600 dark:text-amber-400" : "text-primary")} aria-hidden />
            <span className="min-w-0 flex-1 leading-snug">{e.summary}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <SourceCount n={e.sources} />
              {e.ms > 0 && <span className="text-[11px] text-muted-foreground tabular-nums">{(e.ms / 1000).toFixed(1)} s</span>}
              {e.status === "error" ? <XIcon className="size-3.5 text-destructive" aria-hidden /> : <CheckIcon className="size-3.5 text-primary" strokeWidth={3} aria-hidden />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
