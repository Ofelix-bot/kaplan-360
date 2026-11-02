"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Toggle } from "@/components/ui/toggle";
import { chipsOf, knownChips } from "@/lib/careers/chips";
import type { ChipKind } from "@/lib/careers/types";
import { usePlan } from "@/lib/use-plan";

// One row of toggle chips (Q21, C5): certificates held (CertificateChips) or skills used (SkillChips). Each is a
// Base UI toggle (aria-pressed) that writes its id into the shared answers (PlanAnswers.certificates /
// PlanAnswers.skillChips). While the worked example is open, the chips change the example, as on /plan.
// Unknown ids in old answers are dropped on read (knownChips). Labels are msg() strings of 30 characters or fewer.

const FIELD = { certificate: "certificates", skill: "skillChips" } as const;

export function ChipToggles({ kind, labelledBy, className }: { kind: ChipKind; labelledBy?: string; className?: string }) {
  const t = useT();
  const { answers, update, ready } = usePlan();
  const field = FIELD[kind];
  const held = knownChips(answers[field]);
  const set = (id: string, on: boolean) => {
    const next = on ? [...held.filter((x) => x !== id), id] : held.filter((x) => x !== id);
    update(field === "certificates" ? { certificates: next } : { skillChips: next });
  };
  return (
    <div role="group" aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2", className)}>
      {chipsOf(kind).map((c) => {
        const on = held.includes(c.id);
        return (
          <Toggle
            key={c.id}
            pressed={on}
            disabled={!ready}
            onPressedChange={(p) => set(c.id, p)}
            variant="outline"
            className={cn(
              "h-8 rounded-full border-(--land-line) bg-(--land-card) px-3 text-[13px] font-medium text-(--text) transition-[background-color,border-color,color] duration-150",
              "hover:border-(--brand-ink) hover:bg-(--land-card) focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
              "aria-pressed:border-(--brand-ink) aria-pressed:bg-[color-mix(in_oklab,var(--brand-ink)_10%,var(--land-card))] aria-pressed:text-(--brand-ink)",
            )}
          >
            {on ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden className="text-(--land-body)" />}
            {t(c.label)}
          </Toggle>
        );
      })}
    </div>
  );
}

/** Certificates the student holds: ACCA, CFA Level I, Singapore CA, CPA Australia, AWS. */
export function CertificateChips({ labelledBy, className }: { labelledBy?: string; className?: string }) {
  return <ChipToggles kind="certificate" labelledBy={labelledBy} className={className} />;
}
