"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * One choice out of a few, as a segmented control whose selected pill slides to the new choice
 * (a shared layout animation). Built on the toggle group, so arrow keys move between options.
 */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  tone = "light",
  size = "default",
  className,
}: {
  value: V | null;
  options: { value: V; label: React.ReactNode }[];
  onChange: (v: V) => void;
  label?: string;
  labelledBy?: string;
  /** "brand" sits on the indigo bands. */
  tone?: "light" | "brand";
  size?: "sm" | "default";
  className?: string;
}) {
  const id = useId();
  return (
    <ToggleGroup
      aria-label={label}
      aria-labelledby={labelledBy}
      spacing={0}
      value={value ? [value] : []}
      onValueChange={(v) => v[0] && onChange(v[0] as V)}
      className={cn(
        "relative gap-0 rounded-full p-1",
        tone === "brand" ? "bg-white/10 ring-1 ring-white/20" : "bg-muted ring-1 ring-border",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className={cn(
              "relative rounded-full! border-0 bg-transparent! px-3.5 font-medium transition-colors duration-150 hover:bg-transparent",
              size === "sm" ? "h-7 text-[0.8rem]" : "h-9 text-sm",
              tone === "brand" ? (on ? "text-brand" : "text-white/80 hover:text-white") : on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                aria-hidden
                className={cn("absolute inset-0 rounded-full shadow-sm", tone === "brand" ? "bg-amber" : "bg-primary")}
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
