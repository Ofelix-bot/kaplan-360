import type { CSSProperties } from "react";
import "@/app/ui.css";
import { Fn } from "@/components/shared/receipt/Fn";
import { ReceiptSection } from "@/components/shared/receipt/ReceiptSection";
import { SourceList } from "@/components/shared/receipt/SourceList";
import employment from "@/data/raw/employment.json";
import { RECEIPTS, SOURCES as RECEIPT_SOURCES } from "@/lib/home/receipts";
import { getT } from "@/lib/i18n/server";
import { msg } from "@/lib/i18n/translate";
import { fromRegistry, hostOf, type ReceiptView } from "@/lib/receipts/model";
import Reveal from "./Reveal";
import SalaryDotPlot from "./SalaryDotPlot";
import {
  EMPLOYMENT_LATEST,
  GROUPS,
  REGIONS,
  SALARY_BY_RELEASE,
} from "@/lib/data/employment";

const sgd = (v: number) => `S$${v.toLocaleString("en-SG")}`;
const PEI_COHORT: Record<string, string> = { "2021": "2020/21", "2023": "2022/23", "2024": "2023/24", "2025": "2024/25" };

// /outcomes, below the homepage's explorer and employer band: the salary history with polytechnics,
// the full employment comparison, and graduates abroad. Every figure carries a footnote numeral and each
// section ends with its numbered sources (the shared receipt UI, decisions Q18 and C6). This page has no
// .ui root, so it loads the shared UI's stylesheet itself and puts each source list in a [data-slot] box
// (the stylesheet's scoped preflight reaches .ui and [data-slot] only; a .ui class here would trip check-ui-css).

// ---------- Receipts ----------

type Employment = {
  retrievedAt: string;
  sources: Record<string, { name: string; url: string; published?: string }>;
  records: { id: string; source: string; verbatimQuote?: string }[];
};
const DATA = employment as Employment;

/**
 * A data/raw/employment.json record as a receipt. Only records whose quote was found on the live page
 * are used here: a sentence matched word for word, a table row cell by cell (cells joined by a space).
 */
function recordView(recordId: string, quoteKind: "sentence" | "table-row"): ReceiptView | null {
  const r = DATA.records.find((x) => x.id === recordId);
  const s = r && DATA.sources[r.source];
  if (!r?.verbatimQuote || !s) return null;
  return {
    id: `employment:${recordId}`,
    kind: "official",
    quote: r.verbatimQuote,
    mark: [],
    quoteKind,
    publisher: RECEIPT_SOURCES.swda.name,
    title: s.name.replace(/^[^,]*,\s*/, ""),
    published: s.published ?? null,
    read: DATA.retrievedAt,
    url: s.url,
    host: hostOf(s.url),
    where: null,
    shot: null,
    match: quoteKind === "sentence" ? "word-for-word" : "row",
  };
}

/** The receipts /outcomes reads: the hand-checked registry first, else the employment.json record. */
const BASE: Record<string, ReceiptView> = Object.fromEntries(
  [
    ...["ges-salary", "au-2025-salary", "swda-ges-secured", "qilt-pgc-salary", "hea-hdeg-employed", "hea-pgt-employed"].map((id) => (RECEIPTS[id] ? fromRegistry(RECEIPTS[id]) : null)),
    recordView("sg-pei-2020-21-salary", "sentence"),
    recordView("sg-pei-2022-23-salary", "table-row"),
    recordView("sg-pei-2023-24-salary", "table-row"),
    recordView("sg-pei-2024-25-ftp", "table-row"),
  ]
    .filter((v): v is ReceiptView => v !== null)
    .map((v) => [v.id, v]),
);

/** Which receipt backs each salary figure, by survey release. */
const SALARY_RECEIPT: Record<string, Record<"pei" | "au" | "poly", string>> = {
  "2021": { pei: "employment:sg-pei-2020-21-salary", au: "employment:sg-pei-2020-21-salary", poly: "employment:sg-pei-2020-21-salary" },
  "2023": { pei: "employment:sg-pei-2022-23-salary", au: "employment:sg-pei-2022-23-salary", poly: "employment:sg-pei-2022-23-salary" },
  "2024": { pei: "employment:sg-pei-2023-24-salary", au: "employment:sg-pei-2023-24-salary", poly: "employment:sg-pei-2023-24-salary" },
  "2025": { pei: "ges-salary", au: "au-2025-salary", poly: "au-2025-salary" },
};
const EMPLOYMENT_RECEIPT = { secured: "swda-ges-secured", fullTimePermanent: "employment:sg-pei-2024-25-ftp" } as const;
const REGION_RECEIPT: Record<string, { bachelor: string; master: string }> = {
  Ireland: { bachelor: "hea-hdeg-employed", master: "hea-pgt-employed" },
  Australia: { bachelor: "qilt-pgc-salary", master: "qilt-pgc-salary" },
};

/** A figure and the receipt that prints it: `mark` is the value as the page prints it. */
type Use = { id: string | undefined; mark: string };

/**
 * A section's receipts in reading order, each with the values the section shows highlighted. A figure
 * gets a footnote only when its receipt's quote prints that exact value (`backed`).
 */
function sectionOf(uses: Use[]) {
  const marks = new Map<string, Set<string>>();
  const backed = new Set<string>();
  for (const u of uses) {
    const v = u.id ? BASE[u.id] : undefined;
    if (!v?.quote?.includes(u.mark)) continue;
    backed.add(`${v.id}|${u.mark}`);
    if (!marks.has(v.id)) marks.set(v.id, new Set(v.mark));
    marks.get(v.id)!.add(u.mark);
  }
  const views = [...marks].map(([id, m]) => ({ ...BASE[id], mark: [...m] }));
  const fn = (u: Use) => (u.id && backed.has(`${u.id}|${u.mark}`) ? <Fn id={u.id} /> : null);
  return { views, fn };
}

const dollars = (v: number) => `$${v.toLocaleString("en-SG")}`;
const pct = (v: number) => `${v.toFixed(1)}%`;
/** "A$77,000" as the page prints it: "$77,000". */
const printed = (display: string) => display.replace(/^[A-Z]+(?=\$)/, "");

const salaryUse = (release: string, group: "pei" | "au" | "poly", value: number): Use => ({ id: SALARY_RECEIPT[release]?.[group], mark: dollars(value) });
const employmentUse = (key: keyof typeof EMPLOYMENT_RECEIPT, value: number): Use => ({ id: EMPLOYMENT_RECEIPT[key], mark: pct(value) });
const regionUse = (region: string, level: "bachelor" | "master", display: string): Use => ({ id: REGION_RECEIPT[region]?.[level], mark: printed(display) });

export default async function OutcomesDetail() {
  const t = await getT();
  const detail = sectionOf([
    ...SALARY_BY_RELEASE.flatMap((r) => (["pei", "au", "poly"] as const).map((g) => salaryUse(r.release, g, r[g]))),
    ...(["secured", "fullTimePermanent"] as const).flatMap((key) => EMPLOYMENT_LATEST.map((row) => employmentUse(key, row[key]))),
  ]);
  const abroad = sectionOf(
    REGIONS.flatMap((r) => [r.bachelor && regionUse(r.region, "bachelor", r.bachelor.display), r.master && regionUse(r.region, "master", r.master.display)].filter((u): u is Use => !!u)),
  );
  return (
    <div className="container">
      <Reveal className="ox-more-head">
        <h2 className="cx-table-title">{t("In more detail")}</h2>
      </Reveal>
      <ReceiptSection receipts={detail.views} title={t("In more detail")}>
        <div className="chart-grid">
          <Reveal className="chart-card ox-card">
            <h3>{t("Starting salaries, survey by survey")}</h3>
            <p className="chart-sub">{t("Median gross monthly salary, full-time permanent jobs (S$)")}</p>
            <ul className="legend">
              {(["pei", "au", "poly"] as const).map((g) => (
                <li key={g}>
                  <span className={`swatch swatch-${g}`} aria-hidden="true" />
                  {t(GROUPS[g].short)}
                </li>
              ))}
            </ul>
            <SalaryDotPlot />
            <details className="table-view">
              <summary>{t("View as table")}</summary>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("Survey year")}</th>
                    <th scope="col">{t("Private degree")}</th>
                    <th scope="col">{t("Public university")}</th>
                    <th scope="col">{t("Polytechnic")}</th>
                  </tr>
                </thead>
                <tbody>
                  {SALARY_BY_RELEASE.map((r) => (
                    <tr key={r.release}>
                      <td>
                        {r.release} (PEI {PEI_COHORT[r.release]})
                      </td>
                      {(["pei", "au", "poly"] as const).map((g) => (
                        <td key={g}>
                          {sgd(r[g])}
                          {detail.fn(salaryUse(r.release, g, r[g]))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Reveal>

          <Reveal className="chart-card ox-card">
            <h3>{t("Jobs secured within six months")}</h3>
            <p className="chart-sub">{t("Share of graduates in the labour force, latest survey")}</p>
            <div className="bar-chart">
              {(
                [
                  ["secured", msg("Secured a job")],
                  ["fullTimePermanent", msg("In a full-time permanent job")],
                ] as const
              ).map(([key, title], groupIndex) => (
                <div className="bar-group" key={key}>
                  <p className="bar-group-title">{t(title)}</p>
                  {EMPLOYMENT_LATEST.map((row, i) => (
                    <div className="bar-row" key={row.group} style={{ "--row": groupIndex * 3 + i } as CSSProperties}>
                      <span className="name">{t(GROUPS[row.group].short)}</span>
                      <span className="bar-track">
                        <span
                          className="bar-fill"
                          style={{ width: `${row[key] * 0.82}%`, background: `var(--chart-${row.group})` }}
                        />
                        <span className="bar-value" style={{ left: `${row[key] * 0.82}%` }}>
                          {row[key].toFixed(1)}%
                          {detail.fn(employmentUse(key, row[key]))}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="source-line">{t("Private 2024/25; public university and polytechnic 2025 (post-National Service).")}</p>
          </Reveal>
        </div>
        <div data-slot="receipt-sources">
          <SourceList />
        </div>
      </ReceiptSection>

      <Reveal className="regions-head">
        <h2>{t("Beyond Singapore, a master’s moves the numbers.")}</h2>
      </Reveal>

      <ReceiptSection receipts={abroad.views} title={t("Beyond Singapore, a master’s moves the numbers.")}>
        <div className="regions">
          {REGIONS.map((r, i) => {
            const max = Math.max(r.bachelor?.value ?? 0, r.master?.value ?? 0) || 1;
            return (
              <Reveal key={r.region} className="region-card" index={i}>
                <h3>{t(r.region)}</h3>
                <p className="meta">
                  {t(r.measure)} · {t(r.window)}
                </p>
                {r.bachelor && r.master ? (
                  <div className="region-compare">
                    {(
                      [
                        [msg("Bachelor's"), r.bachelor, "bachelor"],
                        [msg("Master's (taught)"), r.master, "master"],
                      ] as const
                    ).map(([label, v, cls]) => (
                      <div className="row" key={cls}>
                        <div className="row-top">
                          <span>{t(label)}</span>
                          <span>
                            {v.display}
                            {abroad.fn(regionUse(r.region, cls, v.display))}
                          </span>
                        </div>
                        <div className="track">
                          <div className={`fill fill-${cls}`} style={{ width: `${(v.value / max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty">{t("No comparable official figure loaded yet.")}</p>
                )}
                {r.note && <p className="fine">{t(r.note)}</p>}
              </Reveal>
            );
          })}
        </div>
        <div data-slot="receipt-sources">
          <SourceList />
        </div>
      </ReceiptSection>
    </div>
  );
}
