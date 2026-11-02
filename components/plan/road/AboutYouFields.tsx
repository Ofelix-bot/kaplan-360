"use client";

import { useId, useSyncExternalStore } from "react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthName } from "@/lib/i18n/format";
import type { PlanAsk } from "@/lib/plan-timeline";
import { statusPatch, type SgStatus } from "@/lib/plan-storage";
import { usePlan } from "@/lib/use-plan";
import { SG_STATUSES } from "@/lib/profile/options";
import { OutLink } from "./parts";

// PlanAboutYou's three answers (when the student graduates, their status in Singapore, when they took
// their English test) on the shadcn Select, for /plan's Edit sheet and for the short prompts in the
// stop that needs a missing one. The same answers and the same writes as PlanAboutYou; its site-styled
// selects can't sit inside .ui or a sheet, whose scoped reset strips them.

const NONE = "-";
const noSubscribe = () => () => {};
const thisYear = () => new Date().getFullYear();
type Item = { value: string; label: string };

function Choice({ items, value, label, onChange }: { items: Item[]; value: string; label: string; onChange: (v: string) => void }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(!v || v === NONE ? "" : (v as string))}>
      <SelectTrigger className="w-full bg-(--land-card)" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** One answer under its label; in a prompt the question above is the label, so it is read but not shown. */
function Field({ label, hideLabel, children }: { label: string; hideLabel?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5">
      <span id={id} className={cn("text-[13px] font-semibold text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function AboutYouFields({ only }: { only?: Exclude<PlanAsk, "english-test"> }) {
  const t = useT();
  const locale = useIntlLocale();
  const { ready, answers, update } = usePlan();
  const year = useSyncExternalStore(noSubscribe, thisYear, () => null);
  if (!ready || year === null) return null;
  const months: Item[] = [{ value: NONE, label: t("Month") }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(locale, i, "long") }))];
  const yearItems = (list: number[]): Item[] => [{ value: NONE, label: t("Year") }, ...list.map((y) => ({ value: String(y), label: String(y) }))];
  const key = (v: number | null) => (v === null ? NONE : String(v));
  const num = (v: string) => (v ? Number(v) : null);
  const tested = !!answers.englishTest && answers.englishTest !== "none" && answers.englishScore !== null;
  const show = (f: PlanAsk) => !only || only === f;
  return (
    <div className="flex flex-col gap-4">
      {show("graduation") && (
        <Field label={t("You graduate")} hideLabel={!!only}>
          <span className="grid grid-cols-2 gap-2">
            <Choice items={months} value={key(answers.graduationMonth)} label={t("Month")} onChange={(v) => update({ graduationMonth: num(v) })} />
            <Choice items={yearItems(Array.from({ length: 6 }, (_, i) => year + i))} value={key(answers.graduationYear)} label={t("Year")} onChange={(v) => update({ graduationYear: num(v) })} />
          </span>
        </Field>
      )}
      {show("status") && (
        <Field label={t("Status in Singapore")} hideLabel={!!only}>
          <Choice
            items={[{ value: NONE, label: t("Choose…") }, ...SG_STATUSES.map((s) => ({ value: s.value as string, label: t(s.label) }))]}
            value={answers.sgStatus ?? NONE}
            label={t("Status in Singapore")}
            onChange={(v) => update(v && v !== NONE ? statusPatch(v as SgStatus, answers) : { sgStatus: null, status: null })}
          />
        </Field>
      )}
      {show("english-date") && (only || tested) && (
        <Field label={t("English test taken")} hideLabel={!!only}>
          <span className="grid grid-cols-2 gap-2">
            <Choice items={months} value={key(answers.englishTestMonth)} label={t("Month you took the test")} onChange={(v) => update({ englishTestMonth: num(v) })} />
            <Choice items={yearItems(Array.from({ length: 4 }, (_, i) => year - i))} value={key(answers.englishTestYear)} label={t("Year you took the test")} onChange={(v) => update({ englishTestYear: num(v) })} />
          </span>
        </Field>
      )}
    </div>
  );
}

/** A missing answer, asked in the stop that uses it. The English test itself is set with the scores on Programmes. */
export function AskPrompt({ ask }: { ask: PlanAsk }) {
  const t = useT();
  if (ask === "english-test")
    return <p className="text-[14px] text-(--land-body)">{t.rich("Taken an English test? Add your score on <a>Programmes</a>.", { a: (c) => <OutLink href="/results">{c}</OutLink> })}</p>;
  const question =
    ask === "graduation"
      ? t("When do you graduate?")
      : ask === "status"
        ? t("What’s your status in Singapore?")
        : t("When did you take your English test?");
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-(--land-card) p-3 ring-1 ring-(--land-line)">
      <p className="text-[14px] font-medium text-foreground">{question}</p>
      <AboutYouFields only={ask} />
    </div>
  );
}
