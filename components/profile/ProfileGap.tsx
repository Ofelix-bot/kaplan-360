"use client";

import { CircleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { complete, doneCount, part1, part2 } from "@/lib/profile/progress";
import { usePlan } from "@/lib/use-plan";
import { EditProfileLink } from "./EditProfileLink";

// The line at the top of a service page whose part of /profile isn't complete: the Career Compass reads Part 1,
// the Programme finder Part 2. It says how many needed answers are missing and opens /profile at that part
// (and comes back here). Nothing while the answers load, or once the part is complete.

export function ProfileGap({ part, className }: { part: 1 | 2; className?: string }) {
  const t = useT();
  const { answers, ready } = usePlan();
  if (!ready) return null;
  const p = part === 1 ? part1(answers, false) : part2(answers);
  if (complete(p)) return null;
  const n = p.needed.length - doneCount(p.needed);
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[color-mix(in_oklab,var(--accent-ink)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent-ink)_8%,transparent)] px-4 py-2.5 text-sm", className)}>
      <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-(--accent-ink)" />
      <span className="min-w-0 flex-1">
        {part === 1
          ? t(n === 1 ? "Part 1 of your profile is missing 1 needed answer." : "Part 1 of your profile is missing {n} needed answers.", { n })
          : t(n === 1 ? "Part 2 of your profile is missing 1 needed answer." : "Part 2 of your profile is missing {n} needed answers.", { n })}
      </span>
      <EditProfileLink part={part}>{t("Fill them in")}</EditProfileLink>
    </div>
  );
}
