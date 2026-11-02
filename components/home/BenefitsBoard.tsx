"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { BenefitInstitution, BenefitRow } from "@/lib/data/benefits";
import { localToday, stateOf, type BenefitState } from "@/lib/benefit-state";
import { getPlanSnapshot, getServerPlanSnapshot, parsePlan, subscribePlan } from "@/lib/plan-storage";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { msg } from "@/lib/i18n/translate";
import BenefitsCalendar from "./BenefitsCalendar";
import { useThumb } from "./use-thumb";

// /benefits: the homepage's 12-month calendar, then every offer as a card in the same style. The
// calendar's country and partner filters drive the list too. Open / closed is worked out against
// the visitor's date (lib/benefit-state.ts).

const KIND: Record<BenefitRow["kind"], string> = {
  scholarship: "Scholarship",
  "fee-reduction": "Fee reduction",
  "application-fee-waiver": "Application fee waiver",
  deadline: "Application deadline",
  event: "Event",
};

type Type = "all" | "money" | "dates";
const TYPES: { id: Type; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "money", label: "Scholarships & discounts" },
  { id: "dates", label: "Deadlines & events" },
];

const STATE: Record<Exclude<BenefitState, "closed">, { label: string; cls: string }> = {
  open: { label: "Open", cls: "is-up" },
  "no-date": { label: "No closing date", cls: "is-quiet" },
  "last-cycle": { label: "Last cycle", cls: "is-past" },
};


const noSubscribe = () => () => {};

export default function BenefitsBoard({
  benefits,
  institutions,
  kaplanProgrammeUniversity,
}: {
  benefits: BenefitRow[];
  institutions: BenefitInstitution[];
  /** Kaplan programme id → institution id of the university awarding it (for alumni discounts). */
  kaplanProgrammeUniversity: Record<string, string>;
}) {
  const t = useT();
  const locale = useIntlLocale();
  const dateText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const today = useSyncExternalStore(noSubscribe, localToday, () => null);
  const plan = parsePlan(useSyncExternalStore(subscribePlan, getPlanSnapshot, getServerPlanSnapshot));
  const myUniversity = plan?.answers.programmeId ? kaplanProgrammeUniversity[plan.answers.programmeId] : undefined;
  const [country, setCountry] = useState("all");
  const [partnersOnly, setPartnersOnly] = useState(false);
  const [type, setType] = useState<Type>("all");
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const tabsRef = useThumb<HTMLDivElement>(type);
  const inst = useMemo(() => new Map(institutions.map((i) => [i.id, i])), [institutions]);

  const rows = useMemo(() => {
    if (!today) return [];
    return benefits
      .map((b) => ({ b, state: stateOf(b, today), i: inst.get(b.institution_id) }))
      .filter((r): r is typeof r & { state: Exclude<BenefitState, "closed"> } => r.state !== "closed")
      .filter((r) => country === "all" || r.i?.country === country)
      .filter((r) => !partnersOnly || r.i?.kaplan_partner)
      .filter((r) => type === "all" || (type === "dates" ? r.b.kind === "deadline" || r.b.kind === "event" : r.b.kind !== "deadline" && r.b.kind !== "event"));
  }, [benefits, inst, today, country, type, partnersOnly]);

  const dated = rows.filter((r) => r.state === "open").sort((x, y) => (x.b.deadline ?? x.b.event_date ?? "").localeCompare(y.b.deadline ?? y.b.event_date ?? ""));
  const byName = (x: (typeof rows)[number], y: (typeof rows)[number]) => (x.i?.name ?? "").localeCompare(y.i?.name ?? "");
  const undated = rows.filter((r) => r.state === "no-date").sort(byName);
  const earlier = rows.filter((r) => r.state === "last-cycle").sort(byName);

  const card = ({ b, i, state }: (typeof rows)[number]) => {
    const mine = myUniversity === b.institution_id && /alumni/i.test(b.title);
    const date = b.deadline ?? b.event_date;
    const s = STATE[state];
    return (
      <li key={b.id} className="bc-card bb-card">
        <p className="bc-card-kind">
          {t(KIND[b.kind])}
          <span className={`bc-state ${s.cls}`}>{t(s.label)}</span>
        </p>
        <h3>{b.title}</h3>
        <p className="bc-card-uni">
          {i?.name ?? b.institution_id}
          {i?.kaplan_partner && <span className="tag">{t("Kaplan partner")}</span>}
        </p>
        {date && (
          <p className="bc-card-date">
            {state === "last-cycle" ? t("Closed {date} last cycle", { date: dateText(date) }) : b.deadline ? t("Closes {date}", { date: dateText(date) }) : t("On {date}", { date: dateText(date) })}
          </p>
        )}
        {b.value && <p className="bc-card-value">{b.value}</p>}
        {(b.intake || b.format) && (
          <ul className="bb-facts" aria-label={t("Details")}>
            {b.intake && (
              <li>
                <span>{t("Intake")}</span> {b.intake}
              </li>
            )}
            {b.format && (
              <li>
                <span>{t("Where")}</span> {b.format}
              </li>
            )}
          </ul>
        )}
        {mine && <p className="benefit-mine">{t("Your Kaplan degree is awarded by this university. Check whether the offer’s terms cover graduates who studied at Kaplan.")}</p>}
        {b.checklist && (
          <details className="rx-prepare bb-todo">
            <summary>{t("What to do")}</summary>
            <div className="rx-prepare-body">
              {(
                [
                  ["Claim it", b.checklist.claim],
                  ["Know", b.checklist.know],
                  ["Prepare", b.checklist.prepare],
                ] as const
              )
                .filter(([, list]) => list.length)
                .map(([label, list]) => (
                  <div key={label}>
                    <p className="rx-prepare-title">{t(label)}</p>
                    <ul>
                      {list.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </details>
        )}
        <p className="source-line">
          <a href={b.source_url} target="_blank" rel="noopener noreferrer">
            {t("Official page")}
            <span className="visually-hidden">: {b.title}</span>
          </a>{" "}
          · {t("checked {date}", { date: dateText(b.retrieved_at) })}
        </p>
      </li>
    );
  };

  // The first few cards of a group, with a button for the rest.
  const group = (key: string, title: string, list: typeof rows, first: number) =>
    list.length > 0 && (
      <div className="bb-group">
        <h3 className="bb-subhead">
          {t(title)} <span className="bb-n">{list.length}</span>
        </h3>
        <ul className="bb-grid" id={`benefits-${key}`}>
          {(showAll[key] ? list : list.slice(0, first)).map(card)}
        </ul>
        {list.length > first && (
          <button type="button" className="chip bb-more" aria-expanded={!!showAll[key]} aria-controls={`benefits-${key}`} onClick={() => setShowAll((s) => ({ ...s, [key]: !s[key] }))}>
            {showAll[key] ? t("Show fewer") : t("Show all {n}", { n: list.length })}
          </button>
        )}
      </div>
    );

  return (
    <div className="bb">
      <BenefitsCalendar benefits={benefits} institutions={institutions} filters={{ country, setCountry, partnersOnly, setPartnersOnly }} allHref="#all-benefits" />

      <section id="all-benefits" className="bb-all" aria-labelledby="bb-title">
        <div className="bb-head">
          <h2 id="bb-title" className="cx-table-title">
            {country !== "all" ? t("Every offer in {country}", { country: t(country) }) : t("Every offer")}
            {partnersOnly ? t(", Kaplan partners") : ""}
          </h2>
          <div className="segmented" role="tablist" aria-label={t("Type of benefit")} ref={tabsRef}>
            {TYPES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={type === x.id}
                aria-controls="bb-panel"
                className="segment"
                onClick={() => setType(x.id)}
              >
                {t(x.label)}
              </button>
            ))}
          </div>
        </div>

        <div id="bb-panel" role="tabpanel" aria-label={t("Benefits")} className="bb-panel">
          {!today && <div className="rx-loading" aria-busy="true" />}
          {today && rows.length === 0 && <p className="notice">{t("Nothing open for this choice right now. Universities publish the next round over the coming months.")}</p>}
          {group("dated", msg("Closing soonest"), dated, 6)}
          {group("undated", msg("No closing date stated"), undated, 6)}
          {earlier.length > 0 && (
            <details className="bb-earlier">
              <summary>
                {t("Last cycle, for reference")} <span className="bb-n">{earlier.length}</span>
              </summary>
              <p className="source-line">{t("Offered for an intake that has started. These are that round’s terms; check the official page for the next round.")}</p>
              {group("earlier", msg("Closed last cycle"), earlier, 6)}
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
