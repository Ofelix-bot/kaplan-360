"use client";

import { useState, type CSSProperties } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import AnimatedNumber from "./AnimatedNumber";
import Info from "./Info";
import KaplanTrend from "./KaplanTrend";
import { useThumb } from "./use-thumb";
import { HEADLINE, KAPLAN } from "@/lib/data/employment";

// Homepage ①: one chart, three views. Kaplan is the emphasised bar; the comparisons are muted and
// labelled directly. The sources sit behind the "i" button.

type Tab = "employment" | "salary" | "trend";

const TABS: { id: Tab; label: string }[] = [
  { id: "employment", label: "Employment" },
  { id: "salary", label: "Starting salary" },
  { id: "trend", label: "Over time" },
];

const pct = (n: number) => `${n.toFixed(1)}%`;
const sgd = (n: number) => `S$${Math.round(n).toLocaleString("en-SG")}`;

const VIEWS = {
  employment: {
    caption: ["of Kaplan Singapore graduates", "secured a job within six months"],
    format: pct,
    max: 100,
    rows: [
      { label: "Kaplan Singapore", value: KAPLAN.latest.secured, emph: true },
      { label: "Private degree average", value: KAPLAN.compare.pei, emph: false },
      { label: "Public universities", value: KAPLAN.compare.au, emph: false },
    ],
  },
  salary: {
    caption: ["a month: Kaplan Singapore graduates’", "median starting salary"],
    format: sgd,
    max: 5000,
    rows: [
      { label: "Kaplan Singapore", value: KAPLAN.latest.medianSalary, emph: true },
      { label: "Private degree average", value: HEADLINE.pei.value, emph: false },
      { label: "Public universities", value: HEADLINE.au.value, emph: false },
    ],
  },
} as const;

export default function OutcomesExplorer() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("employment");
  const view = tab === "trend" ? null : VIEWS[tab];
  const src = KAPLAN.latest.source;
  const tabsRef = useThumb<HTMLDivElement>(tab);

  return (
    <div className="ox">
      <div className="ox-bar">
        <div className="segmented" role="tablist" aria-label={t("Graduate outcomes")} ref={tabsRef}>
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`ox-tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls="ox-panel"
              className="segment"
              onClick={() => setTab(x.id)}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
        <Info id="ox-info" title={t("Sources")}>
          <p className="source-line">
            {t("Sources:")}{" "}
            {[src, ...KAPLAN.trend.filter((r) => r.source.url !== src.url).map((r) => r.source)].map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              </span>
            ))}
          </p>
        </Info>
      </div>

      <div id="ox-panel" role="tabpanel" aria-labelledby={`ox-tab-${tab}`} className="ox-panel">
        {view ? (
          <div className="ox-grid">
            <div className="ox-figure">
              <AnimatedNumber className="ox-value" value={view.rows[0].value} format={view.format} />
              <p className="ox-caption">
                {t(view.caption[0])}
                <br />
                {t(view.caption[1])}, {KAPLAN.latest.cohort}
              </p>
            </div>
            <dl className="ox-bars">
              {view.rows.map((r, i) => (
                <div key={r.label} className={`ox-row${r.emph ? " is-emph" : ""}`} style={{ "--i": i } as CSSProperties}>
                  <dt>{t(r.label)}</dt>
                  <dd>
                    <span className="ox-track" aria-hidden="true">
                      <span className="ox-fill" style={{ "--v": r.value / view.max } as CSSProperties} />
                    </span>
                    <span className="ox-num">{view.format(r.value)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="ox-trend">
            <ul className="legend">
              <li>
                <span className="swatch swatch-emph" aria-hidden="true" />
                {t("Kaplan Singapore")}
              </li>
              <li>
                <span className="swatch swatch-muted" aria-hidden="true" />
                {t("Private degree average")}
              </li>
            </ul>
            <KaplanTrend />
          </div>
        )}
      </div>
    </div>
  );
}
