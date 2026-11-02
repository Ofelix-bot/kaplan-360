"use client";

import { needsWorkPass } from "@/lib/ep";
import { usePlan } from "@/lib/use-plan";
import { BanknoteIcon, ClipboardListIcon, UsersRoundIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { DRAFT } from "@/content/draft";

// The two hot-role badges (Q10, Q19): "MOM needs" (MOM's per-industry Job Vacancies 2025 ranks, or "MOM
// needs: EP list" when it rests on the COMPASS Shortage Occupation List) and "High pay" (Kaplan 360++'s
// rule: an OWT 2025 median in the industry's top quarter). A lucide icon and words, never a coloured dot, so
// the meaning never rests on colour. Inline (spans), so they sit inside a card label's <p>. The receipts
// behind them are the caller's Fns (RoleCard's extra row, the role page's heading).
// A client component so the server role page can render it too.

const C = DRAFT.careers.badges;

const BASE =
  "inline-flex max-w-full items-center gap-1 rounded-full border border-solid px-2 py-0.5 text-[12px] leading-[18px] font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0";

export function MomNeedsBadge({ sol: onList, className }: { sol: boolean; className?: string }) {
  const t = useT();
  const { answers } = usePlan();
  // The EP shortage list matters only to someone who needs a work pass.
  const sol = onList && needsWorkPass(answers);
  const Icon = sol ? ClipboardListIcon : UsersRoundIcon;
  return (
    <span
      className={cn(
        BASE,
        "border-[color-mix(in_oklab,var(--brand-ink)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-ink)_8%,transparent)] text-(--brand-ink)",
        className,
      )}
    >
      <Icon aria-hidden />
      {t(sol ? C.momNeedsSol : C.momNeeds)}
    </span>
  );
}

export function HighPayBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        BASE,
        "border-[color-mix(in_oklab,var(--accent-ink)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-(--accent-ink)",
        className,
      )}
    >
      <BanknoteIcon aria-hidden />
      {t(C.highPay)}
    </span>
  );
}

/** Both badges a role earns, in the fixed order MOM needs → High pay. Nothing when it earns neither. */
export function RoleBadges({ momNeeds, sol, highPay, className }: { momNeeds: boolean; sol: boolean; highPay: boolean; className?: string }) {
  if (!momNeeds && !highPay) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {momNeeds && <MomNeedsBadge sol={sol} />}
      {highPay && <HighPayBadge />}
    </span>
  );
}
