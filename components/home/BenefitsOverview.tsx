"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { BenefitInstitution, BenefitRow } from "@/lib/data/benefits";
import { localToday, stateOf } from "@/lib/benefit-state";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { ArrowSquare } from "@/components/shared/ArrowSquare";
import AnimatedNumber from "./AnimatedNumber";
import Info from "./Info";
import { useThumb } from "./use-thumb";

// Homepage ③, in the outcomes chart's style: what closes next, and what is open now by type and by
// country. The chosen bar is emphasised and its figure is the big number. Open or closed is worked
// out against the visitor's own date (lib/benefit-state.ts).

type Tab = "closing" | "type" | "country";

const TABS: { id: Tab; label: string }[] = [
  { id: "closing", label: "Closing soon" },
  { id: "type", label: "By type" },
  { id: "country", label: "By country" },
];

const KINDS: Record<BenefitRow["kind"], string> = {
  scholarship: "Scholarships",
  "fee-reduction": "Fee reductions",
  "application-fee-waiver": "Application fee waivers",
  deadline: "Application deadlines",
  event: "Events",
};

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / DAY);
const short = (iso: string, locale: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });
const count = (n: number) => Math.round(n).toLocaleString("en-SG");
const noSubscribe = () => () => {};

type Row = { id: string; label: string; sub?: string; value: number; num: string; url?: string };

export default function BenefitsOverview({ benefits, institutions }: { benefits: BenefitRow[]; institutions: BenefitInstitution[] }) {
  const t = useT();
  const locale = useIntlLocale();
  const today = useSyncExternalStore(noSubscribe, localToday, () => null);
  const [tab, setTab] = useState<Tab>("closing");
  const [picked, setPicked] = useState<Partial<Record<Tab, string>>>({});
  const tabsRef = useThumb<HTMLDivElement>(tab);
  const inst = useMemo(() => new Map(institutions.map((i) => [i.id, i])), [institutions]);

  const views = useMemo(() => {
    if (!today) return null;
    const live = benefits.map((b) => ({ b, s: stateOf(b, today), i: inst.get(b.institution_id) })).filter((x) => x.s === "open" || x.s === "no-date");
    const dated = live
      .filter((x) => x.s === "open")
      .map((x) => ({ ...x, date: (x.b.deadline ?? x.b.event_date)! }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
    const tally = (key: (x: (typeof live)[number]) => string | null | undefined) =>
      [...live.reduce((m, x) => (key(x) ? m.set(key(x)!, (m.get(key(x)!) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
    const closing: Row[] = dated.map((x) => {
      const d = Math.max(0, days(today, x.date));
      return { id: x.b.id, label: x.b.title, sub: x.i?.name, value: d, num: short(x.date, locale), url: x.b.source_url };
    });
    const type: Row[] = tally((x) => KINDS[x.b.kind]).map(([k, n]) => ({ id: k, label: t(k), value: n, num: count(n) }));
    const country: Row[] = tally((x) => x.i?.country)
      .slice(0, 6)
      .map(([c, n]) => ({ id: c, label: t(c), value: n, num: count(n) }));
    return { closing, type, country, total: live.length, partners: live.filter((x) => x.i?.kaplan_partner).length };
  }, [benefits, inst, today, locale, t]);

  const rows = views?.[tab] ?? [];
  const current = rows.find((r) => r.id === picked[tab]) ?? rows[0];
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="ox">
      <div className="ox-bar">
        <div className="segmented" role="tablist" aria-label={t("Benefits you can claim")} ref={tabsRef}>
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`bv-tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls="bv-panel"
              className="segment"
              onClick={() => setTab(x.id)}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
        <Info id="bv-info" title={t("About these figures")}>
          <p>
            {t.rich(
              "<b>Benefits:</b> scholarships, fee reductions, application fee waivers, deadlines and events for international taught master’s students, from official university pages.",
              { b: (c) => <strong>{c}</strong> },
            )}
          </p>
          <p>
            {t.rich(
              "<b>Open now:</b> worked out against today’s date in your browser. A deadline that has passed is left out; an award with no closing date counts while its intake or academic year is current.",
              { b: (c) => <strong>{c}</strong> },
            )}
          </p>
          <p>{t.rich("<b>Closing soon:</b> the next six dated deadlines and events; a shorter bar closes sooner. Each links to its official page.", { b: (c) => <strong>{c}</strong> })}</p>
        </Info>
      </div>

      <div id="bv-panel" role="tabpanel" aria-labelledby={`bv-tab-${tab}`} className="ox-panel">
        {!views || !current ? (
          <div className="rx-loading" aria-busy={!views} />
        ) : (
          <div className="ox-grid is-tall">
            <div className="ox-figure">
              {tab === "closing" ? (
                <>
                  <AnimatedNumber className="ox-value" value={current.value} format={(n) => (Math.round(n) === 0 ? t("Today") : t(Math.round(n) === 1 ? "{n} day" : "{n} days", { n: Math.round(n) }))} />
                  <p className="ox-caption">
                    {current.value === 0 ? t("closes today, {date}", { date: current.num }) : t("until it closes, {date}", { date: current.num })}
                    <br />
                    <strong className="cv-strong">{current.label}</strong>
                    {current.sub ? ` · ${current.sub}` : ""}
                  </p>
                  {current.url && (
                    <a href={current.url} target="_blank" rel="noopener noreferrer" className="see-all cv-more">
                      {t("Official page")}<ArrowSquare />
                    </a>
                  )}
                </>
              ) : (
                <>
                  <AnimatedNumber className="ox-value" value={current.value} format={count} />
                  <p className="ox-caption">
                    {tab === "type" ? t("{kind} open now", { kind: t.has(current.id) ? current.label : current.label.toLowerCase() }) : t("offers in {country} open now", { country: current.label })}
                    <br />
                    {t("of {total} in all, {partners} at Kaplan partners", { total: count(views.total), partners: count(views.partners) })}
                  </p>
                </>
              )}
            </div>
            <ol className="ox-bars ox-pick" aria-label={t(TABS.find((x) => x.id === tab)!.label)}>
              {rows.map((r, i) => {
                const on = r.id === current.id;
                return (
                  <li key={r.id} className={`ox-row${on ? " is-emph" : ""}`} style={{ "--i": i } as CSSProperties}>
                    <button type="button" aria-pressed={on} onClick={() => setPicked((p) => ({ ...p, [tab]: r.id }))}>
                      <span className="ox-row-label">
                        {r.label}
                        {r.sub && <span className="ox-row-sub"> · {r.sub}</span>}
                      </span>
                      <span className="ox-row-bar">
                        <span className="ox-track" aria-hidden="true">
                          <span className="ox-fill" style={{ "--v": Math.max(0.02, r.value / max) } as CSSProperties} />
                        </span>
                        <span className="ox-num">{r.num}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
