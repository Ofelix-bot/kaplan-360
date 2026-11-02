"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DRAFT } from "@/content/draft";
import { REGIONS, type Region } from "@/lib/careers/types";

// Singapore / Asia Pacific / Global (Q5, Q17, C3): one choice for every industry page, kept per visitor in
// localStorage (wrapped: it throws in a private window or with blocked site data, and then the choice lives
// for the visit only). The stored value is read in an effect, so the static HTML and the first client render
// both show Singapore and hydration matches. A region with no figure in today's reports is a disabled option
// whose words say so (at most 30 characters); a stored choice that is disabled on this industry falls back to
// Singapore (pickRegion), never to another region's figures.

const KEY = "kaplan360:careers-region";
const C = DRAFT.careers.region;

const isRegion = (v: unknown): v is Region => typeof v === "string" && (REGIONS as readonly string[]).includes(v);

export const useCareersRegion = create<{ region: Region; set: (region: Region) => void }>((set) => ({
  region: "singapore",
  set: (region) => {
    set({ region });
    try {
      window.localStorage.setItem(KEY, region);
    } catch {
      // Kept in memory for this visit.
    }
  },
}));

/** The region to show: the visitor's choice where this industry has figures for it, else Singapore. */
export function pickRegion(region: Region, regions: Record<Region, boolean>): Region {
  return region === "singapore" || regions[region] ? region : "singapore";
}

const NAME: Record<Region, string> = { singapore: C.singapore, "asia-pacific": C.asiaPacific, global: C.global };
const NONE: Record<Region, string | null> = { singapore: null, "asia-pacific": C.noAsiaPacific, global: C.noGlobal };

const TONE = {
  /** On the purple industry band (.on-dark): white words, the pressed option a white pill. */
  band: "text-white hover:bg-white/12 hover:text-white aria-pressed:bg-white aria-pressed:text-(--tile-brand) disabled:text-white/70",
  /** On a light panel (the dropdown on phones). */
  light: "text-(--text) hover:bg-(--land-ground) hover:text-(--text) aria-pressed:bg-(--tile-brand) aria-pressed:text-white disabled:text-(--land-body)",
} as const;

export function RegionToggle({ regions, tone = "band", className }: { regions: Record<Region, boolean>; tone?: keyof typeof TONE; className?: string }) {
  const t = useT();
  const region = useCareersRegion((s) => s.region);
  const setRegion = useCareersRegion((s) => s.set);
  const shown = pickRegion(region, regions);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (isRegion(stored)) useCareersRegion.setState({ region: stored });
    } catch {
      // No storage: Singapore, the default.
    }
  }, []);

  return (
    <ToggleGroup
      aria-label={t(C.label)}
      value={[shown]}
      onValueChange={(v) => {
        const next = v[0];
        // Pressing the option already on would clear the group: a region is always chosen.
        if (isRegion(next)) setRegion(next);
      }}
      spacing={1}
      className={cn("flex-wrap", className)}
    >
      {REGIONS.map((r) => {
        const off = r !== "singapore" && !regions[r];
        const none = NONE[r];
        return (
          <ToggleGroupItem
            key={r}
            value={r}
            disabled={off}
            size="sm"
            className={cn(
              "h-8 rounded-full px-3 text-[13px] font-semibold transition-[background-color,color] duration-200 motion-reduce:transition-none",
              "focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)",
              "disabled:font-medium disabled:opacity-100",
              TONE[tone],
            )}
          >
            {off && none ? t(none) : t(NAME[r])}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
