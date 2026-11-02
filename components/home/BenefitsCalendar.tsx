"use client";

import Link from "@/components/i18n/Link";
import { ArrowSquare } from "@/components/shared/ArrowSquare";
import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Info from "./Info";
import { localToday, stateOf, type BenefitState } from "@/lib/benefit-state";
import type { BenefitInstitution, BenefitRow } from "@/lib/data/benefits";

// Homepage ③: the next 12 months of deadlines, one lane per type. Dates still ahead are solid;
// last cycle's dates are hollow, placed on the same day and month in the coming 12 months, until
// the next round's date is published. Open / closed is worked out against the visitor's own date.

type Lane = "scholarship" | "fee" | "deadline" | "event";
const LANES: { id: Lane; label: string; one: string }[] = [
  { id: "scholarship", label: "Scholarships", one: "Scholarship" },
  { id: "fee", label: "Fee reductions", one: "Fee reduction" },
  { id: "deadline", label: "Application deadlines", one: "Application deadline" },
  { id: "event", label: "Events", one: "Event" },
];
const laneOf = (k: BenefitRow["kind"]): Lane => (k === "scholarship" ? "scholarship" : k === "deadline" ? "deadline" : k === "event" ? "event" : "fee");

const DAY = 86_400_000;
const W = 1100;
const LEFT = 178;
const RIGHT = 14;
const HEAD = 64; // bracket, today label and month names
const LANE_H = 58;
const FOOT = 30; // week ticks and the hover readout
const H = HEAD + LANE_H * LANES.length + FOOT;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

const noSubscribe = () => () => {};

type Point = { b: BenefitRow; inst?: BenefitInstitution; lane: Lane; at: Date; past: boolean };

/** Filters held by the page, so the full list on /benefits follows the calendar. */
export type CalendarFilters = { country: string; setCountry: (c: string) => void; partnersOnly: boolean; setPartnersOnly: (v: boolean) => void };

export default function BenefitsCalendar({
  benefits,
  institutions,
  filters,
  allHref = "/benefits",
}: {
  benefits: BenefitRow[];
  institutions: BenefitInstitution[];
  filters?: CalendarFilters;
  /** Where "Always open" leads when there are more than fit here. */
  allHref?: string;
}) {
  const t = useT();
  const locale = useIntlLocale();
  const dateText = (d: Date, year = true) => d.toLocaleDateString(locale, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  const monthText = (d: Date) => d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
  const todayIso = useSyncExternalStore(noSubscribe, localToday, () => null);
  const [ownCountry, setOwnCountry] = useState("all");
  const [ownPartnersOnly, setOwnPartnersOnly] = useState(false);
  const country = filters?.country ?? ownCountry;
  const setCountry = filters?.setCountry ?? setOwnCountry;
  const partnersOnly = filters?.partnersOnly ?? ownPartnersOnly;
  const setPartnersOnly = filters?.setPartnersOnly ?? setOwnPartnersOnly;
  const [picked, setPicked] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [showAlways, setShowAlways] = useState(false);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const inst = useMemo(() => new Map(institutions.map((i) => [i.id, i])), [institutions]);
  const countries = [...new Set(institutions.map((i) => i.country).filter((c): c is string => !!c))].sort();

  const model = useMemo(() => {
    if (!todayIso) return null;
    const today = parse(todayIso);
    const end = new Date(today);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    const rows = benefits
      .map((b) => ({ b, i: inst.get(b.institution_id), state: stateOf(b, todayIso) as BenefitState }))
      .filter((r) => (country === "all" || r.i?.country === country) && (!partnersOnly || r.i?.kaplan_partner));
    const points: Point[] = rows
      .filter((r) => (r.b.deadline ?? r.b.event_date) && r.state !== "last-cycle")
      .map((r) => {
        const d = parse((r.b.deadline ?? r.b.event_date)!);
        if (d >= today) return { b: r.b, inst: r.i, lane: laneOf(r.b.kind), at: d, past: false };
        // Last cycle: the next time its month and day come round.
        const n = new Date(d);
        while (n < today) n.setUTCFullYear(n.getUTCFullYear() + 1);
        return { b: r.b, inst: r.i, lane: laneOf(r.b.kind), at: n, past: true };
      })
      .filter((p) => p.at < end)
      .sort((a, b) => Number(a.past) - Number(b.past) || +a.at - +b.at);
    const always = rows.filter((r) => r.state === "no-date");
    const open = rows.filter((r) => r.state === "open" || r.state === "no-date").length;
    return { today, end, points, always, open };
  }, [benefits, inst, todayIso, country, partnersOnly]);

  if (!model) return <div className="bc bc-loading" aria-busy="true" />;
  const { today, end, points, always, open } = model;

  const X = (d: Date) => LEFT + ((+d - +today) / (+end - +today)) * (W - LEFT - RIGHT);
  const toDate = (x: number) => new Date(+today + ((x - LEFT) / (W - LEFT - RIGHT)) * (+end - +today));

  // Months in the window: bands, names and the year boundary.
  const months: { start: Date; stop: Date }[] = [];
  for (let m = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); m < end; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    months.push({ start: m < today ? today : m, stop: new Date(Math.min(+end, Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) });
  }
  const weeks: Date[] = [];
  for (let d = new Date(+today + ((8 - today.getUTCDay()) % 7) * DAY); d < end; d = new Date(+d + 7 * DAY)) weeks.push(d);

  // Where most dates fall: the longest run of months holding at least half the busiest month's count.
  const perMonth = months.map((m) => points.filter((p) => p.at >= m.start && p.at < m.stop).length);
  const busiest = Math.max(0, ...perMonth);
  let run: [number, number] | null = null;
  if (busiest >= 3) {
    let s = -1;
    perMonth.forEach((n, i) => {
      if (n >= busiest / 2) {
        if (s < 0) s = i;
        if (!run || i - s > run[1] - run[0]) run = [s, i];
      } else s = -1;
    });
  }
  const bracket = run as [number, number] | null;

  // Points sharing a lane and a few days stack alternately above and below the lane line.
  const slots = new Map<string, number>();
  const placed = points.map((p, i) => {
    const li = LANES.findIndex((l) => l.id === p.lane);
    const key = `${li}:${Math.round(X(p.at) / 13)}`;
    const k = slots.get(key) ?? 0;
    slots.set(key, k + 1);
    const off = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 13;
    return { p, i, cx: X(p.at), cy: HEAD + LANE_H * li + LANE_H / 2 + off, id: `${p.b.id}` };
  });
  const upcoming = points.filter((p) => !p.past);
  const current = points.find((p) => p.b.id === picked) ?? upcoming[0] ?? points[0];

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || e.pointerType !== "mouse") return;
    const x = (e.clientX - ctm.e) / ctm.a;
    setHoverX(x >= LEFT && x <= W - RIGHT ? x : null);
  };

  const monthsWithItems = months
    .map((m) => ({ key: iso(m.start).slice(0, 7), label: m.start.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }), items: points.filter((p) => p.at >= m.start && p.at < m.stop) }))
    .filter((m) => m.items.length);
  const maxMonth = Math.max(1, ...monthsWithItems.map((m) => m.items.length));

  return (
    <div className="bc">
      <div className="bc-bar">
        <div className="bc-filters" role="group" aria-label={t("Filter benefits")}>
          <label>
            <span className="visually-hidden">{t("Country")}</span>
            <select className="select" value={country} onChange={(e) => (setCountry(e.target.value), setPicked(null))}>
              <option value="all">{t("All countries")}</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="benefits-check">
            <input type="checkbox" checked={partnersOnly} onChange={(e) => (setPartnersOnly(e.target.checked), setPicked(null))} />
            {t("Kaplan partner universities only")}
          </label>
        </div>
        <div className="bc-count">
          <p aria-live="polite">
            {t.rich("<v>{n}</v> open now", { v: (c) => <span className="bc-count-value">{c}</span> }, { n: open })}
          </p>
          <Info id="bc-info" title={t("About this calendar")}>
            <p>
              {t(
                "Scholarships, fee reductions, application deadlines and events read from each university’s own pages, starting with Kaplan partner universities. Each value was checked word for word against the page.",
              )}
            </p>
            <p>
              {t.rich(
                "<b>Solid points</b> close in the next 12 months. <b>Hollow points</b> closed last cycle and are shown on the same day and month in the coming 12 months, until the university publishes the new date: check the official page.",
                { b: (c) => <strong>{c}</strong> },
              )}
            </p>
            <p>
              {t.rich(
                "<b>Always open</b>: offers that state no closing date. Closed offers are hidden automatically, against today’s date in your browser.",
                { b: (c) => <strong>{c}</strong> },
              )}
            </p>
          </Info>
        </div>
      </div>

      <div className="bc-chart">
        <svg
          ref={svgRef}
          className="bc-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={t("Benefit deadlines over the next 12 months")}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
        >
          {/* month bands and names */}
          {months.map((m, i) => {
            const x1 = X(m.start);
            const x2 = X(m.stop);
            const jan = m.start.getUTCMonth() === 0 && m.start.getUTCDate() === 1;
            return (
              <g key={iso(m.start)}>
                {i % 2 === 1 && <rect className="bc-band" x={x1} y={HEAD - 18} width={x2 - x1} height={LANE_H * LANES.length + 18} />}
                {x2 - x1 > 34 && (
                  <text className="bc-month" x={(x1 + x2) / 2} y={HEAD - 6} textAnchor="middle">
                    {monthText(m.start)}
                  </text>
                )}
                {jan && (
                  <>
                    <line className="bc-year-line" x1={x1} x2={x1} y1={HEAD - 30} y2={HEAD + LANE_H * LANES.length} />
                    <text className="bc-year" x={x1 + 5} y={HEAD - 22}>
                      {m.start.getUTCFullYear()}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* busiest stretch */}
          {bracket && (
            <g className="bc-bracket" aria-hidden="true">
              <path d={`M${X(months[bracket[0]].start) + 4} 22 V16 H${X(months[bracket[1]].stop) - 4} V22`} />
              <text x={(X(months[bracket[0]].start) + X(months[bracket[1]].stop)) / 2} y={10} textAnchor="middle">
                {t("Most deadlines fall {from}–{to}", { from: monthText(months[bracket[0]].start), to: monthText(months[bracket[1]].start) })}
              </text>
            </g>
          )}

          {/* lanes */}
          {LANES.map((l, i) => {
            const y = HEAD + LANE_H * i + LANE_H / 2;
            const n = points.filter((p) => p.lane === l.id).length;
            return (
              <g key={l.id}>
                <line className="bc-lane" x1={LEFT - 8} x2={W - RIGHT} y1={y} y2={y} />
                <text className="bc-lane-label" x={0} y={y} dy="-0.15em">
                  {t(l.label)}
                </text>
                <text className="bc-lane-count" x={0} y={y} dy="1.15em">
                  {t(n === 1 ? "{n} date" : "{n} dates", { n })}
                </text>
              </g>
            );
          })}

          {/* axis: baseline and week ticks */}
          <line className="bc-axis" x1={LEFT} x2={W - RIGHT} y1={H - FOOT} y2={H - FOOT} />
          {weeks.map((d) => (
            <line key={+d} className="bc-week" x1={X(d)} x2={X(d)} y1={H - FOOT} y2={H - FOOT + 4} />
          ))}

          {/* today */}
          <line className="bc-today" x1={LEFT} x2={LEFT} y1={HEAD - 30} y2={H - FOOT} />
          <g className="bc-today-pill" transform={`translate(${LEFT} ${HEAD - 44})`}>
            <rect x={-2} y={-11} width={92} height={22} rx={11} />
            <text x={44} y={0} dy="0.35em" textAnchor="middle">
              {t("Today · {date}", { date: dateText(today, false) })}
            </text>
          </g>

          {/* hover guide */}
          {hoverX !== null && (
            <g className="bc-guide" aria-hidden="true">
              <line x1={hoverX} x2={hoverX} y1={HEAD - 18} y2={H - FOOT} />
              <text x={Math.min(Math.max(hoverX, LEFT + 40), W - RIGHT - 40)} y={H - 8} textAnchor="middle">
                {dateText(toDate(hoverX))}
              </text>
            </g>
          )}

          {/* points */}
          {placed.map(({ p, i, cx, cy, id }) => {
            const on = current?.b.id === p.b.id;
            const when = dateText(parse((p.b.deadline ?? p.b.event_date)!));
            const label = `${p.b.title}, ${p.inst?.name ?? ""}, ${p.past ? t("last cycle closed {date}", { date: when }) : t("closes {date}", { date: when })}`;
            return (
              <g
                key={id}
                className={`bc-pt ${p.past ? "is-past" : "is-up"}${on ? " is-on" : ""}`}
                style={{ "--i": i } as CSSProperties}
                tabIndex={0}
                role="button"
                aria-pressed={on}
                aria-label={label}
                onClick={() => setPicked(p.b.id)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setPicked(p.b.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setPicked(p.b.id))}
              >
                <circle className="bc-hit" cx={cx} cy={cy} r={12} />
                <circle className="bc-mark" cx={cx} cy={cy} r={6} />
              </g>
            );
          })}
        </svg>
        <ul className="legend bc-legend">
          <li>
            <span className="bc-key is-up" aria-hidden="true" />
            {t("Closes in the next 12 months")}
          </li>
          <li>
            <span className="bc-key is-past" aria-hidden="true" />
            {t("Last cycle’s date, where it would fall again")}
          </li>
        </ul>
      </div>

      {/* Phone: months as a list */}
      <ul className="bc-months" aria-label={t("Benefit deadlines by month")}>
        {monthsWithItems.map((m) => (
          <li key={m.key}>
            <button type="button" aria-expanded={openMonth === m.key} onClick={() => setOpenMonth(openMonth === m.key ? null : m.key)}>
              <span className="bc-months-name">{m.label}</span>
              <span className="bc-months-track" aria-hidden="true">
                <span className="bc-months-fill" style={{ "--v": m.items.length / maxMonth } as CSSProperties} />
              </span>
              <span className="bc-months-n">{m.items.length}</span>
            </button>
            {openMonth === m.key && (
              <ul className="bc-months-items">
                {m.items.map((p) => (
                  <li key={p.b.id}>
                    <span className={`bc-key ${p.past ? "is-past" : "is-up"}`} aria-hidden="true" />
                    <span>
                      {p.b.title}
                      <span className="bc-sub">
                        {p.inst?.name} ·{" "}
                        {p.past
                          ? t("last cycle {date}", { date: dateText(parse((p.b.deadline ?? p.b.event_date)!)) })
                          : t("closes {date}", { date: dateText(parse((p.b.deadline ?? p.b.event_date)!)) })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="bc-lower">
        {current ? (
          <article key={current.b.id} className="bc-card" aria-live="polite">
            <p className="bc-card-kind">
              {t(LANES.find((l) => l.id === current.lane)?.one ?? "")}
              <span className={`bc-state ${current.past ? "is-past" : "is-up"}`}>{current.past ? t("Last cycle") : t("Open")}</span>
            </p>
            <h3>{current.b.title}</h3>
            <p className="bc-card-uni">
              {current.inst?.name}
              {current.inst?.kaplan_partner && <span className="tag">{t("Kaplan partner")}</span>}
            </p>
            <p className="bc-card-date">
              {current.past
                ? t("Closed {date} last cycle. Shown on the same day and month until the next round’s date is published.", { date: dateText(parse((current.b.deadline ?? current.b.event_date)!)) })
                : t("Closes {date}", { date: dateText(current.at) })}
            </p>
            {current.b.value && <p className="bc-card-value">{current.b.value}</p>}
            <p className="source-line">
              <a href={current.b.source_url} target="_blank" rel="noopener noreferrer">
                {t("Official page")}
                <span className="visually-hidden">: {current.b.title}</span>
              </a>{" "}
              · {t("checked {date}", { date: dateText(parse(current.b.retrieved_at)) })}
            </p>
          </article>
        ) : (
          <p className="notice">{t("Nothing dated for this choice. Universities publish the next round over the coming months.")}</p>
        )}
        <div className="bc-side">
          <p className="bc-side-title">{t("Closing next")}</p>
          <ol className="bc-next">
            {upcoming.slice(0, 3).map((p) => (
              <li key={p.b.id}>
                <button type="button" onClick={() => setPicked(p.b.id)}>
                  <span className="bc-next-date">{dateText(p.at, false)}</span>
                  <span className="bc-next-title">
                    {p.b.title}
                    <span className="bc-sub">{p.inst?.name}</span>
                  </span>
                </button>
              </li>
            ))}
            {upcoming.length === 0 && <li className="bc-sub">{t("Nothing closes in the next 12 months for this choice.")}</li>}
          </ol>
          <button type="button" className="chip bc-always" aria-expanded={showAlways} aria-controls="bc-always" onClick={() => setShowAlways((v) => !v)}>
            {t("Always open · {n}", { n: always.length })}
          </button>
        </div>
      </div>

      {showAlways && (
        <div id="bc-always" className="bc-always-list">
          <ul>
            {always.slice(0, 12).map(({ b, i }) => (
              <li key={b.id}>
                <a href={b.source_url} target="_blank" rel="noopener noreferrer">
                  {b.title}
                </a>
                <span className="bc-sub">
                  {i?.name} · {t(LANES.find((l) => l.id === laneOf(b.kind))?.one ?? "")}
                </span>
              </li>
            ))}
          </ul>
          {always.length > 12 && (
            <Link href={allHref} className="see-all">
              {allHref.startsWith("#") ? t("All {n} in the full list below", { n: always.length }) : t("All {n} on the benefits page", { n: always.length })}<ArrowSquare />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
