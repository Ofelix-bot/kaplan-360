"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, BookmarkPlusIcon, CheckIcon, Undo2Icon } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import type { Final } from "@/lib/agent/types";
import { monthYear } from "@/lib/i18n/format";
import type { SkillGap } from "@/lib/plan-storage";
import { useResultsData } from "@/lib/workspace/data";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { cn } from "cn";

// Step 4 of AI adviser v2: the dated steps (education and career in two colours), the skill gaps, up to three
// programmes, and "Save to my plan" (picks onto the shortlist, gaps into the plan's skill gaps) with a 10 s undo.

/** The skill-gap id /careers uses (components/careers/RoleGapPanel.tsx), so a gap saved twice stays one row. */
const gapId = (roleId: string, skill: string) => `${roleId}-${skill.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** "2026-11" as a month index, or null. */
function monthIndex(when: string): number | null {
  const m = /^(\d{4})-(\d{1,2})/.exec(when);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}

function useProgrammeName() {
  const byId = useResultsData((s) => s.byId);
  return (id: string) => byId?.get(id)?.name ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Before = { shortlist: string[]; skillGaps: SkillGap[] };

export function Roadmap({ final }: { final: Final }) {
  const t = useT();
  const locale = useIntlLocale();
  const name = useProgrammeName();
  const [saved, setSaved] = useState<Before | null>(null);
  const [undone, setUndone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const picks = final.picks.slice(0, 3);
  const steps = [...final.roadmap].sort((a, b) => a.when.localeCompare(b.when));
  const label = (when: string) => {
    const i = monthIndex(when);
    return i === null ? when : monthYear(locale, i);
  };

  const save = () => {
    const a = usePlanStore.getState().answers;
    const before = { shortlist: a.shortlist, skillGaps: a.skillGaps };
    const gaps: SkillGap[] = final.gaps.map((g) => ({
      id: gapId(g.roleId, g.skill),
      roleId: g.roleId,
      role: g.role,
      skill: g.skill,
      level: g.level ?? 0,
      via: g.fix === "degree" ? "kaplan" : "outside",
      module: null,
      own: g.fix === "degree",
    }));
    usePlanStore.getState().update({
      shortlist: [...new Set([...a.shortlist, ...picks.map((p) => p.programmeId)])],
      skillGaps: [...a.skillGaps.filter((x) => !gaps.some((g) => g.id === x.id)), ...gaps],
    });
    setSaved(before);
    setUndone(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(null), 10_000);
  };

  const undo = () => {
    if (!saved) return;
    usePlanStore.getState().update(saved);
    setSaved(null);
    setUndone(true);
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className={cn("flex items-baseline gap-3 text-sm", s.lane === "education" ? "text-primary" : "text-amber-700 dark:text-amber-400")}>
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-current" aria-hidden />
            <span className="w-20 shrink-0 text-xs font-semibold tabular-nums">{label(s.when)}</span>
            <span className="sr-only">{s.lane === "education" ? t("Education") : t("Career")}: </span>
            <span className="min-w-0 text-foreground">{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="flex gap-3 text-[11px]">
        <span className="flex items-center gap-1 text-primary">
          <span className="inline-block size-2 rounded-full bg-current" aria-hidden /> {t("Education")}
        </span>
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <span className="inline-block size-2 rounded-full bg-current" aria-hidden /> {t("Career")}
        </span>
      </p>

      {!!final.gaps.length && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t("Skill gaps")}</p>
          <ul className="space-y-1 text-sm">
            {final.gaps.map((g, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{g.skill}</span>
                <span className={cn("rounded px-1.5 text-[11px]", g.fix === "degree" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
                  {g.fix === "degree" ? t("At Kaplan") : t("Outside")}
                </span>
                <span className="text-muted-foreground">{g.how}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!picks.length && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t("Programmes to look at")}</p>
          <ul className="space-y-1.5 text-sm">
            {picks.map((p) => (
              <li key={p.programmeId}>
                <Link href={`/results?programme=${encodeURIComponent(p.programmeId)}`} className="font-medium text-primary underline-offset-2 hover:underline">
                  {name(p.programmeId)}
                </Link>
                <span className="text-muted-foreground"> · {p.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={!!saved}>
          {saved ? <CheckIcon aria-hidden /> : <BookmarkPlusIcon aria-hidden />}
          {saved ? t("Saved") : t("Save to my plan")}
        </Button>
        {(saved || undone) && (
          <Link href="/plan" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline">
            {t("Open your plan")} <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {saved && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg" role="status">
          <CheckIcon className="size-4 shrink-0 text-primary" strokeWidth={3} aria-hidden />
          <span className="flex-1">{t("Saved {p} programmes and {g} skill gaps to your plan.", { p: picks.length, g: final.gaps.length })}</span>
          <Button size="sm" variant="ghost" onClick={undo}>
            <Undo2Icon aria-hidden />
            {t("Undo")}
          </Button>
        </div>
      )}
    </div>
  );
}
