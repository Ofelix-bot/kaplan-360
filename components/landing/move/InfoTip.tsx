"use client";

import { useId, useState } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// /move's info icon: the extra line a screen leaves out, behind a small "i" (the site's Base UI tooltip,
// components/ui/tooltip). It opens on hover and on keyboard focus as any tooltip does, and on a tap or
// click as well (touch has no hover), which also closes it. The button is named by `label`; the text is
// also its description for screen readers (a visually hidden copy, since the tooltip is only in the DOM
// while open). tone "night" is for the dark grounds.

export function InfoTip({ label, text, tone = "light", side = "top", className }: { label: string; text: string; tone?: "light" | "night"; side?: "top" | "bottom" | "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        closeOnClick={false}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-describedby={id}
        className={cn(
          "inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 align-middle transition-colors duration-200 motion-reduce:transition-none",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid",
          tone === "night" ? "text-(--land-night-body) hover:text-(--land-night-ink)" : "text-muted-foreground hover:text-(--brand-ink)",
          className,
        )}
      >
        <InfoIcon aria-hidden className="size-[18px]" />
      </TooltipTrigger>
      <span id={id} className="sr-only">
        {text}
      </span>
      <TooltipContent side={side} className="max-w-[300px] px-3 py-2 text-[13px] leading-snug text-pretty">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
