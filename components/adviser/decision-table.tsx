"use client";

import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import type { Claim, Final, SourceRef } from "@/lib/agent/types";
import { msg } from "@/lib/i18n/translate";
import { cn } from "cn";
import { CRITERIA } from "./debate-columns";

// Step 3 of AI adviser v2: cost, benefit, risk and fit for a master's first and for work first, which way the judge
// leans and why. Each claim's sources are footnote numbers; the footnotes link to the page on this site that holds them.

const LEAN: Record<Final["decision"]["lean"], string> = { study: msg("Master’s first"), work: msg("Work first"), both: msg("Work first, then a master’s") };
const KIND: Record<SourceRef["kind"], string> = { programme: msg("Programme"), employment: msg("Graduate outcomes"), ep: msg("Employment Pass"), career: msg("Role"), policy: msg("Policy") };

const keyOf = (s: SourceRef) => `${s.kind}:${s.id}:${s.field ?? ""}`;

function hrefOf(s: SourceRef): string | null {
  if (s.kind === "programme") return `/results?programme=${encodeURIComponent(s.id)}`;
  if (s.kind === "career") return `/careers/roles/${encodeURIComponent(s.id)}`;
  if (s.kind === "employment") return "/outcomes";
  return null;
}

export function DecisionTable({ final }: { final: Final }) {
  const t = useT();
  const { rows, lean, why } = final.decision;
  const notes: SourceRef[] = [];
  const index = new Map<string, number>();
  const numbers = (c: Claim) =>
    c.sources.map((s) => {
      const k = keyOf(s);
      if (!index.has(k)) {
        notes.push(s);
        index.set(k, notes.length);
      }
      return index.get(k)!;
    });
  const cell = (c: Claim) => {
    const ns = numbers(c);
    return (
      <>
        {c.text}
        {!!ns.length && <sup className="ml-0.5 text-[10px] text-primary">{ns.join(",")}</sup>}
      </>
    );
  };
  const body = rows.map((r) => ({ criterion: r.criterion, study: cell(r.study), work: cell(r.work) }));
  const whyCell = cell(why);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="w-20 p-2 text-left font-medium" />
              <th className={cn("p-2 text-left font-semibold", lean !== "work" && "text-primary")}>{t("Master’s first")}</th>
              <th className={cn("p-2 text-left font-semibold", lean !== "study" && "text-primary")}>{t("Work first")}</th>
            </tr>
          </thead>
          <tbody>
            {body.map((r) => (
              <tr key={r.criterion} className="border-t align-top">
                <th className="p-2 text-left text-xs font-medium text-muted-foreground">{t(CRITERIA[r.criterion])}</th>
                <td className="p-2 leading-snug">{r.study}</td>
                <td className="p-2 leading-snug">{r.work}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
        <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">{t(LEAN[lean])}</span>
        <span className="min-w-0 flex-1 leading-snug">{whyCell}</span>
      </div>
      {!!notes.length && (
        <ol className="space-y-0.5 text-[11px] text-muted-foreground">
          {notes.map((s, i) => {
            const href = hrefOf(s);
            const label = `${t(KIND[s.kind] ?? msg("Source"))} · ${s.id}${s.field ? ` · ${s.field}` : ""}`;
            return (
              <li key={keyOf(s)}>
                <sup className="mr-1 text-primary">{i + 1}</sup>
                {href ? (
                  <Link href={href} className="underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
