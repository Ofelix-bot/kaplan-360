"use client";

import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import type { Claim, Final, SourceRef } from "@/lib/agent/types";
import { msg } from "@/lib/i18n/translate";
import s from "./adviser.module.css";
import { CRITERIA } from "./debate-columns";

// Step 3 of AI adviser v2: which way the judge leans and why (first, in the display face), then cost, benefit, risk and
// fit for a master's first and for work first. Each claim's sources are footnote numbers; the footnotes link to the page
// on this site that holds them.

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
        {!!ns.length && <sup>{ns.join(",")}</sup>}
      </>
    );
  };
  const body = rows.map((r) => ({ criterion: r.criterion, study: cell(r.study), work: cell(r.work) }));
  const whyCell = cell(why);

  return (
    <div className="grid gap-3">
      <div className={s.lean}>
        <span className={s.tag}>{t(LEAN[lean])}</span>
        <span className="min-w-0 flex-1 text-sm leading-snug">{whyCell}</span>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th />
              <th data-lean={lean !== "work" ? "" : undefined}>{t("Master’s first")}</th>
              <th data-lean={lean !== "study" ? "" : undefined}>{t("Work first")}</th>
            </tr>
          </thead>
          <tbody>
            {body.map((r) => (
              <tr key={r.criterion}>
                <th scope="row">{t(CRITERIA[r.criterion])}</th>
                <td>{r.study}</td>
                <td>{r.work}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!notes.length && (
        <ol className={s.notes}>
          {notes.map((n, i) => {
            const href = hrefOf(n);
            const label = `${t(KIND[n.kind] ?? msg("Source"))} · ${n.id}${n.field ? ` · ${n.field}` : ""}`;
            return (
              <li key={keyOf(n)}>
                <sup>{i + 1}</sup> 
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
