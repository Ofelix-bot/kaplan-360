"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FOCUS } from "./bands";

// The inputs' small parts, sized so the whole form fits one phone screen (375 × 667): a label over
// each control, a number kept as typed until it is valid, a select from a list, and a − n + stepper.

/** A select's value for "not set". */
export const NONE = "-";

export function FieldLabel({ id, htmlFor, children, hint }: { id?: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <Tag id={id} htmlFor={htmlFor} className="flex min-h-4 items-baseline gap-1 truncate text-xs leading-4 font-medium text-(--land-body)">
      {children}
      {hint && <span className="truncate font-normal text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

/** A number, kept as typed until it is a valid value; empty clears it. */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  placeholder,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  placeholder?: string;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="bg-(--land-card)">
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder={placeholder}
          value={draft ?? value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const v = raw === "" ? null : Number(raw);
            if (v === null || (Number.isFinite(v) && v >= min && v <= max)) onChange(v);
          }}
          onBlur={() => setDraft(null)}
          className="tabular-nums"
        />
        {suffix && (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}

export type PickItem = { value: string; label: string };

/** One choice from a list (grouped when `groups` is given). */
export function Pick({
  label,
  hint,
  value,
  items,
  groups,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  items: PickItem[];
  groups?: { label: string; items: PickItem[] }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const all = groups ? [...items, ...groups.flatMap((g) => g.items)] : items;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <FieldLabel id={id} hint={hint}>
        {label}
      </FieldLabel>
      <Select items={all} value={value} disabled={disabled} onValueChange={(v) => onChange(typeof v === "string" ? v : NONE)}>
        <SelectTrigger className="w-full min-w-0 bg-(--land-card)" aria-labelledby={id}>
          <SelectValue placeholder={placeholder} className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="max-h-80">
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {groups?.map((g) => (
            <SelectGroup key={g.label}>
              <SelectLabel>{g.label}</SelectLabel>
              {g.items.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A count: − n +. Null shows a dash (not answered); the first tap on either button answers it. */
export function Stepper({ label, value, max, onChange, className }: { label: string; value: number | null; max: number; onChange: (v: number) => void; className?: string }) {
  const t = useT();
  const id = useId();
  const v = value ?? 0;
  return (
    <div role="group" aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-1", className)}>
      <FieldLabel id={id}>{label}</FieldLabel>
      <div className="flex h-8 items-center justify-between rounded-lg border border-input bg-(--land-card)">
        <Button variant="ghost" size="icon" className={cn("size-8 rounded-r-none", FOCUS, "-outline-offset-2")} aria-label={t("One less: {label}", { label })} disabled={value !== null && v <= 0} onClick={() => onChange(value === null ? 0 : Math.max(0, v - 1))}>
          <MinusIcon />
        </Button>
        <output aria-live="polite" className="min-w-6 text-center text-sm font-semibold tabular-nums">
          {value === null ? "–" : v}
        </output>
        <Button variant="ghost" size="icon" className={cn("size-8 rounded-l-none", FOCUS, "-outline-offset-2")} aria-label={t("One more: {label}", { label })} disabled={v >= max} onClick={() => onChange(Math.min(max, value === null ? 1 : v + 1))}>
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
