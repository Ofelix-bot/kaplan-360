"use client";

import { useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * A number edited where it stands: click (or Enter) turns it into a field; Enter or leaving the field
 * keeps the new value, Escape keeps the old one. Out-of-range values are brought into range.
 */
export function InlineNumber({
  value,
  onChange,
  format,
  label,
  min,
  max,
  round = 1000,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
  /** What the number is, for the field's label. */
  label: string;
  min: number;
  max: number;
  round?: number;
  className?: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const back = useRef(false);

  useEffect(() => {
    if (editing) input.current?.select();
    else if (back.current) {
      back.current = false;
      button.current?.focus();
    }
  }, [editing]);

  /** `refocus`: the edit ended from the keyboard, so focus goes back to the number (not when the field lost focus to something else). */
  const finish = (keep: boolean, refocus: boolean) => {
    if (!editing) return;
    if (keep) {
      const n = Math.min(max, Math.max(min, Math.round(Number(draft.replace(/[^\d.]/g, "")) / round) * round));
      if (Number.isFinite(n) && n > 0 && n !== value) onChange(n);
    }
    back.current = refocus;
    setEditing(false);
  };

  if (editing)
    return (
      <input
        ref={input}
        inputMode="numeric"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={(e) => {
          // Handled here, so the same key press doesn't also press the number's button once it is back.
          if (e.key === "Enter" || e.key === "Escape") e.preventDefault();
          if (e.key === "Enter") finish(true, true);
          if (e.key === "Escape") finish(false, true);
        }}
        className={cn("w-[8ch] rounded-md border border-primary bg-background px-1.5 py-0.5 font-semibold text-foreground tabular-nums outline-none ring-3 ring-ring/30 [field-sizing:content] min-w-[6ch]", className)}
      />
    );
  return (
    <button
      ref={button}
      type="button"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      aria-label={t("{label}: {value}. Edit", { label, value: format(value) })}
      className={cn(
        "group/edit inline-flex items-baseline gap-1 rounded-md px-1 font-semibold text-foreground underline decoration-primary/50 decoration-dotted decoration-2 underline-offset-4 transition-colors outline-none hover:bg-primary/8 hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="tabular-nums">{format(value)}</span>
      <PencilIcon aria-hidden className="size-3 self-center text-primary opacity-60 transition-opacity group-hover/edit:opacity-100" />
    </button>
  );
}
