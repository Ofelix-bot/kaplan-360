"use client";

import { useId, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { DIRECTION_GROUPS, directionLabel, MAX_DIRECTIONS } from "@/lib/finder/directions";
import { transitions } from "@/lib/motion";
import { Chip } from "./parts";

// The master's directions: a box that opens in place onto three groups of chips, up to three chosen.

export function DirectionPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const sep = locale === "en" ? ", " : "、";
  const full = value.length >= MAX_DIRECTIONS;
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : full ? value : [...value, d]);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          open ? "border-primary" : "border-border",
        )}
      >
        <span className={cn("truncate", value.length ? "" : "text-muted-foreground")}>
          {value.length ? t("Chosen: {list}", { list: value.map((d) => t(directionLabel(d))).join(sep) }) : t("Choose up to 3")}
        </span>
        <ChevronDownIcon aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: transitions.exit }}
            className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            {DIRECTION_GROUPS.map((g) => (
              <div key={g.label} className="flex flex-col gap-2.5" role="group" aria-label={t(g.label)}>
                <p className="text-xs font-semibold text-muted-foreground">{t(g.label)}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((d) => (
                    <Chip key={d.id} pressed={value.includes(d.id)} disabled={full && !value.includes(d.id)} onPressedChange={() => toggle(d.id)}>
                      {t(d.label)}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {t("Chosen {n} / {m}", { n: value.length, m: MAX_DIRECTIONS })}
              </span>
              <Button variant="outline" className="h-10 px-4" onClick={() => setOpen(false)}>
                {t("Done")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
