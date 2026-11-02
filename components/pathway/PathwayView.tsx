"use client";

import Link from "@/components/i18n/Link";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Info from "@/components/home/Info";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { duration, monthYear } from "@/lib/i18n/format";
import type { T } from "@/lib/i18n/translate";
import { useThumb } from "@/components/home/use-thumb";
import MonthDots from "@/components/plan/MonthDots";
import PlanAboutYou from "@/components/plan/PlanAboutYou";
import type { School } from "@/lib/data/topups";
import { universityKey, type UniversityFacts } from "@/lib/pathway";
import type { DiplomaLevel } from "@/lib/plan-storage";
import { compare, overall, type Background, type Check, type CheckState, type TopupCard } from "@/lib/topups";
import { usePlan } from "@/lib/use-plan";

// /pathway, "Plan my path": the degrees a diploma student can continue to in Singapore.
// At Kaplan: Kaplan's degrees, then other private schools' top-ups, each list ordered by how well it
// fits the diploma's field and background. At another school: the Kaplan degrees that school's
// diploma can lead to. Every check compares the student's background with the programme's published words; the
// timeline estimates when each Kaplan step could start, from the deck's 2026 intake months.

type Diploma = { id: string; name: string; discipline: string; level: string };
type Scholarship = { id: string; university: string | null; title: string; short: string; value: string; places: string | null };

const months = (l: [number, number]) => (l[0] === l[1] ? `${l[0]}` : `${l[0]}–${l[1]}`);
const k = (n: number) => `S$${Math.round(n / 1000)}k`;
const ROUTE: Record<string, string> = { "top-up": "Top-up", "advanced-standing": "Advanced standing", "direct-honours": "Honours", "full-degree": "Full degree" };
const LEVELS: { value: DiplomaLevel; label: string }[] = [
  { value: "diploma", label: "Diploma" },
  { value: "advanced-diploma", label: "Advanced Diploma" },
  { value: "higher-diploma", label: "Higher Diploma" },
];
const PILL: Record<CheckState, string> = { met: "is-meets", check: "is-unknown", not: "is-below" };
const MARK: Record<CheckState, string> = { met: "✓", check: "?", not: "!" };
const RANK: Record<CheckState, number> = { met: 0, check: 1, not: 2 };

/** A programme page's grant sentence as a short label: "Grant S$1,635 · local". */
function grantLabel(g: string, t: T) {
  const amount = g.match(/S\$\s?[\d,]+(\.\d+)?/)?.[0];
  if (!amount) return g.length > 40 ? `${g.slice(0, 38)}…` : g;
  return /local applicants/i.test(g) ? t("Grant {amount} · local", { amount: amount.replace(/\s/, "") }) : t("Grant {amount}", { amount: amount.replace(/\s/, "") });
}

function nextIntake(grad: number, intakeMonths: number[]): number | null {
  const y0 = Math.floor(grad / 12);
  for (let y = y0; y <= y0 + 2; y++) for (const m of intakeMonths) if (y * 12 + m - 1 > grad) return y * 12 + m - 1;
  return null;
}

function Pills({ checks }: { checks: Check[] }) {
  const t = useT();
  return (
    <ul className="rx-pills">
      {checks.map((c) => (
        <li key={c.key} className={`rx-pill ${PILL[c.state]}`} title={c.quote ?? undefined}>
          <span className="rx-check-mark" aria-hidden="true">
            {MARK[c.state]}
          </span>
          <span className="rx-pill-need">{t(c.label)}</span>
          <span className="visually-hidden">{c.state === "met" ? t(": meets the published requirement") : c.state === "not" ? t(": not met") : t(": check the official wording")}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PathwayView({
  diplomas,
  facts,
  topups,
  schools,
  scholarships,
  disciplines,
}: {
  diplomas: Diploma[];
  facts: Record<string, UniversityFacts>;
  topups: TopupCard[];
  schools: School[];
  scholarships: Scholarship[];
  disciplines: Record<string, string>;
}) {
  const t = useT();
  const locale = useIntlLocale();
  const names = useSiteNames();
  const label = (m: number) => monthYear(locale, m);
  const ym = (s: string) => monthYear(locale, Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1);
  const { ready, answers, update } = usePlan();
  const [view, setView] = useState<"matches" | "timeline">("matches");
  const [picked, setPicked] = useState<string | null>(null);
  const [topUpOnly, setTopUpOnly] = useState(false);
  const [allFields, setAllFields] = useState(false);
  // After "Plan with this", bring the next-step button into view so the student can carry on.
  const jump = useRef(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jump.current || !answers.pathwayDegreeId) return;
    jump.current = false;
    const next = actionsRef.current?.querySelector<HTMLAnchorElement>("a.button-solid");
    if (!next) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    next.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    next.focus({ preventScroll: true });
    next.classList.remove("is-arrived");
    void next.offsetWidth;
    next.classList.add("is-arrived");
  }, [answers.pathwayDegreeId]);
  const tabsRef = useThumb<HTMLDivElement>(answers.school ? "other" : "kaplan");
  const viewRef = useThumb<HTMLDivElement>(view);
  if (!ready) return <div className="rx-loading" aria-busy="true" />;

  const atKaplan = !answers.school;
  const diploma = diplomas.find((d) => d.id === answers.programmeId);
  const school = schools.find((s) => s.id === (answers.school ?? "kaplan")) ?? schools[0];
  const discipline = atKaplan ? (diploma?.discipline ?? null) : answers.schoolDiscipline;
  const bg: Background = {
    school: school.id,
    discipline,
    level: atKaplan ? (diploma?.level === "advanced-diploma" ? "advanced-diploma" : "diploma") : (answers.diplomaLevel ?? "diploma"),
    studentPass: answers.status === "student-pass",
    ielts: answers.englishTest === "ielts" ? answers.englishScore : null,
  };

  const scored = topups.map((x) => {
    const checks = compare(x, bg);
    return { t: x, checks, state: overall(checks) };
  });
  const inField = (x: (typeof scored)[number]) => allFields || !discipline || x.t.discipline === discipline;
  // Field match first (it matters once "All fields" is on), then the published requirements.
  const byMatch = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    Number(b.t.discipline === discipline) - Number(a.t.discipline === discipline) || RANK[a.state] - RANK[b.state];
  const kaplanAll = scored.filter((x) => x.t.provider === "kaplan" && inField(x));
  const kaplanRows = kaplanAll
    .filter((x) => !topUpOnly || x.t.route === "top-up")
    .filter((x) => !picked || x.t.university === picked)
    .sort((a, b) => byMatch(a, b) || Number(b.t.route === "top-up") - Number(a.t.route === "top-up") || a.t.name.localeCompare(b.t.name));
  const others = atKaplan ? scored.filter((x) => x.t.provider !== "kaplan" && inField(x) && (!topUpOnly || x.t.route === "top-up")) : [];
  const otherProviders = [...new Set(others.map((x) => x.t.provider))];

  // Matches chart: per partner university, how many of its degrees in the field meet every published requirement.
  const unis = [...new Set(kaplanAll.map((x) => x.t.university ?? "Kaplan"))].map((u) => {
    const rows = kaplanAll.filter((x) => (x.t.university ?? "Kaplan") === u);
    return { u, total: rows.length, met: rows.filter((x) => x.state === "met").length, check: rows.filter((x) => x.state === "check").length };
  });
  unis.sort((a, b) => b.met - a.met || b.total - a.total);
  const met = kaplanAll.filter((x) => x.state === "met").length;
  const toCheck = kaplanAll.filter((x) => x.state === "check").length;
  const maxTotal = Math.max(1, ...unis.map((u) => u.total));

  // Timeline: the deck's intake months and lengths per partner university.
  const grad = answers.graduationYear && answers.graduationMonth ? answers.graduationYear * 12 + answers.graduationMonth - 1 : null;
  const timeline = unis
    .map(({ u }) => {
      const f = facts[universityKey(u)];
      const start = grad != null && f?.intakeMonths.length ? nextIntake(grad, f.intakeMonths) : null;
      const masters = start != null && f?.lengthMonths ? start + f.lengthMonths[0] + 1 : null;
      return { u, f, start, masters };
    })
    .sort((a, b) => (a.masters ?? Infinity) - (b.masters ?? Infinity));
  const ends = timeline.flatMap((r) => (r.start != null && r.f?.lengthMonths ? [r.start + r.f.lengthMonths[1] - grad!] : []));
  const T = Math.max(24, Math.ceil((Math.max(0, ...ends) + 3) / 6) * 6);
  const at = (t: number) => `${((t - (grad ?? 0)) / T) * 100}%`;
  const years = grad == null ? [] : Array.from({ length: Math.floor((grad + T) / 12) - Math.floor(grad / 12) }, (_, i) => (Math.floor(grad / 12) + i + 1) * 12);
  const currentT = timeline.find((r) => r.u === picked) ?? timeline[0];

  const chosen = topups.find((x) => x.kaplanId && x.kaplanId === answers.pathwayDegreeId) ?? null;
  const fee = (x: TopupCard) => (bg.studentPass ? (x.feeInternational ?? (x.international ? x.feeLocal : null)) : x.feeLocal);
  const uniScholarships = (x: TopupCard) => (x.provider === "kaplan" ? scholarships.filter((s) => (s.university ? s.university === x.university : atKaplan)) : []);
  const otherSchools = schools.filter((s) => s.id !== "kaplan");

  const setTab = (other: boolean) =>
    update(other ? { school: answers.school ?? otherSchools[0].id, level: "diploma", pathwayDegreeId: null } : { school: null, pathwayDegreeId: null });

  return (
    <div className="pw">
      <div className="pw-who">
        <div className="segmented" role="tablist" aria-label={t("Where you study")} ref={tabsRef}>
          <button type="button" role="tab" className="segment" aria-selected={atKaplan} onClick={() => setTab(false)}>
            {t("At Kaplan")}
          </button>
          <button type="button" role="tab" className="segment" aria-selected={!atKaplan} onClick={() => setTab(true)}>
            {t("At another school")}
          </button>
        </div>
        <div className="pw-me">
          {atKaplan ? (
            <label className="pw-pick">
              <span className="visually-hidden">{t("Your Kaplan diploma")}</span>
              <select className="select" value={answers.programmeId ?? ""} onChange={(e) => update({ programmeId: e.target.value || null, level: "diploma", pathwayDegreeId: null })}>
                <option value="">{t("Choose your Kaplan diploma…")}</option>
                {Object.entries(disciplines).map(([key, name]) => {
                  const items = diplomas.filter((d) => d.discipline === key);
                  return items.length ? (
                    <optgroup key={key} label={t(name)}>
                      {items.map((d) => (
                        <option key={d.id} value={d.id}>
                          {names.degree(d.name).name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </label>
          ) : (
            <>
              <label className="pw-pick">
                <span className="visually-hidden">{t("Your school")}</span>
                <select className="select" value={answers.school ?? ""} onChange={(e) => update({ school: e.target.value, pathwayDegreeId: null })}>
                  {otherSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {names.school(s.name).name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pw-pick">
                <span className="visually-hidden">{t("Your diploma’s field")}</span>
                <select className="select" value={answers.schoolDiscipline ?? ""} onChange={(e) => update({ schoolDiscipline: e.target.value || null, pathwayDegreeId: null })}>
                  <option value="">{t("Your diploma’s field…")}</option>
                  {Object.entries(disciplines).map(([key, name]) => (
                    <option key={key} value={key}>
                      {t(name)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="opts" role="radiogroup" aria-label={t("Diploma level")}>
                {LEVELS.map((l) => (
                  <label key={l.value} className="opt">
                    <input type="radio" name="pw-level" checked={(answers.diplomaLevel ?? "diploma") === l.value} onChange={() => update({ diplomaLevel: l.value })} />
                    <span>{t(l.label)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <label className="pw-pass">
            <input
              type="checkbox"
              checked={bg.studentPass}
              onChange={(e) => update({ status: e.target.checked ? "student-pass" : answers.status === "student-pass" ? "citizen-pr" : answers.status })}
            />
            <span>{t("Student’s Pass")}</span>
          </label>
          <span className={`pw-badge${school.cscseFrom ? "" : " is-off"}`} title={t("China’s CSCSE certification list, 14 Sep 2026")}>
            {school.cscseFrom ? t("CSCSE listed · since {date}", { date: ym(school.cscseFrom) }) : t("Not on CSCSE’s list")}
          </span>
        </div>
      </div>

      {!discipline ? (
        <p className="notice">{atKaplan ? t("Choose your Kaplan diploma to see the degrees that continue it.") : t("Choose your diploma’s field to see the Kaplan degrees it can lead to.")}</p>
      ) : (
        <>
          <div className="ox">
            <div className="ox-bar">
              <div className="segmented" role="tablist" aria-label={t("Chart")} ref={viewRef}>
                <button type="button" role="tab" className="segment" aria-selected={view === "matches"} onClick={() => setView("matches")}>
                  {t("Your matches")}
                </button>
                <button type="button" role="tab" className="segment" aria-selected={view === "timeline"} onClick={() => setView("timeline")}>
                  {t("Timeline")}
                </button>
              </div>
              <Info id="pw-info" title={t("CSCSE")}>
                <p>
                  {t.rich(
                    "<b>CSCSE:</b> China’s Service Center for Scholarly Exchange lists the schools and universities it certifies in its <a>notice of 14 Sep 2026</a>; the notice says nothing on study mode. The in-person rule is from <k>Kaplan’s CSCSE page</k>: “international academic programmes seeking accreditation must be completed on campus with in-person classes”, and Kaplan’s part-time programmes “include a combination of in-person classes and online learning”. Ask CSCSE before you choose part-time study.",
                    {
                      b: (c) => <strong>{c}</strong>,
                      a: (c) => (
                        <a href="https://zwfw.cscse.edu.cn/zwfw/lxfwzxwsfwdt2020/xlxwrz32/tzgg61/2026091416463289686/index.html" target="_blank" rel="noopener noreferrer">
                          {c}
                        </a>
                      ),
                      k: (c) => (
                        <a href="https://www.kaplan.com.sg/international-applicants-chinese-service-centre-for-scholarly-exchange-cscse-accreditation" target="_blank" rel="noopener noreferrer">
                          {c}
                        </a>
                      ),
                    },
                  )}
                </p>
              </Info>
            </div>

            {view === "matches" ? (
              <div className="ox-grid is-tall">
                <div className="ox-figure">
                  <p className="cv-title">{disciplines[discipline] ? t(disciplines[discipline]) : t("Your field")}</p>
                  <span className="ox-value">{met}</span>
                  <p className="ox-caption">
                    {t("Kaplan degrees where you meet every published requirement")}
                    {toCheck > 0 && (
                      <>
                        <br />
                        {t.rich("<b>{n} more</b> to confirm with Kaplan", { b: (c) => <strong className="cv-strong">{c}</strong> }, { n: toCheck })}
                      </>
                    )}
                  </p>
                </div>
                <ol className="ox-bars ox-pick" aria-label={t("Kaplan partner universities")}>
                  {unis.map((u, i) => {
                    const on = picked === u.u;
                    return (
                      <li key={u.u} className={`ox-row${on || !picked ? " is-emph" : ""}`} style={{ "--i": i } as CSSProperties}>
                        <button type="button" aria-pressed={on} onClick={() => setPicked(on ? null : u.u)}>
                          <span className="ox-row-label">{names.school(u.u).name}</span>
                          <span className="ox-row-bar">
                            <span className="ox-track pw-stack" aria-hidden="true">
                              <span className="ox-fill" style={{ "--v": u.met / maxTotal } as CSSProperties} />
                              <span className="pw-stack-check" style={{ left: `${(u.met / maxTotal) * 100}%`, width: `${(u.check / maxTotal) * 100}%` }} />
                            </span>
                            <span className="ox-num">
                              {u.met}/{u.total}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : grad == null ? (
              <div className="notice">
                <p>{t("Add when your diploma ends to see the earliest start of each step.")}</p>
                <PlanAboutYou only="graduation" />
              </div>
            ) : (
              <div className="ox-grid is-tall">
                <div className="ox-figure">
                  <p className="cv-title">{currentT?.u}</p>
                  {currentT?.masters != null ? (
                    <>
                      <span className="ox-value is-wide">{label(currentT.masters)}</span>
                      <p className="ox-caption">
                        {t("earliest master’s start, {span} after your diploma", { span: duration(t, currentT.masters - grad) })}
                        <br />
                        {t.rich(
                          "<b>Degree from {date}</b>, about {n} months",
                          { b: (c) => <strong className="cv-strong">{c}</strong> },
                          { date: label(currentT.start!), n: months(currentT.f!.lengthMonths!) },
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="ox-value is-wide">{t("Ask Kaplan")}</span>
                      <p className="ox-caption">{t("Kaplan’s deck gives no intake dates or length for this university.")}</p>
                    </>
                  )}
                </div>
                <div className="pw-chart">
                  <ol className="ox-bars ox-pick pw-rows" aria-label={t("Partner universities, by earliest master’s start")}>
                    {timeline.map((r, i) => {
                      const on = r.u === currentT?.u;
                      const l = r.f?.lengthMonths;
                      return (
                        <li key={r.u} className={`ox-row${on ? " is-emph" : ""}`} style={{ "--i": i } as CSSProperties}>
                          <button type="button" aria-pressed={on} onClick={() => setPicked(r.u)}>
                            <span className="visually-hidden">
                              {`${r.u}: `}
                              {r.masters != null ? t("degree from {start}, about {n} months, master’s from {masters}", { start: label(r.start!), n: months(l!), masters: label(r.masters) }) : t("no dates in Kaplan’s deck")}
                            </span>
                            <span className="ox-row-label" aria-hidden="true">
                              {r.u}
                            </span>
                            <span className="ox-row-bar" aria-hidden="true">
                              {r.start != null && l ? (
                                <span className="pw-track">
                                  <span className="pw-wait" style={{ left: 0, width: at(r.start) }} />
                                  <span className="pw-study" style={{ left: at(r.start), width: `${(l[0] / T) * 100}%` }} />
                                  {l[1] > l[0] && <span className="pw-extra" style={{ left: at(r.start + l[0]), width: `${((l[1] - l[0]) / T) * 100}%` }} />}
                                  <span className="pw-ms" style={{ left: at(r.masters!) }} />
                                </span>
                              ) : (
                                <span className="pw-track is-empty">{t("No dates in Kaplan’s deck")}</span>
                              )}
                              <span className="ox-num">{r.masters != null ? label(r.masters) : "–"}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="pw-axis" aria-hidden="true">
                    <span className="pw-axis-track">
                      {years.map((y) => (
                        <span key={y} className="pw-tick" style={{ left: at(y) }}>
                          {y / 12}
                        </span>
                      ))}
                    </span>
                    <span />
                  </div>
                  <ul className="pw-key" aria-label={t("Key")}>
                    <li>
                      <i className="k-wait" /> {t("Until the intake")}
                    </li>
                    <li>
                      <i className="k-study" /> {t("Degree")}
                    </li>
                    <li>
                      <i className="k-ms" /> {t("Master’s")}
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <section className="pw-options" aria-labelledby="pw-kaplan-title">
            <div className="pw-options-head">
              <h2 id="pw-kaplan-title">
                {picked ? t("Kaplan degrees with {university}", { university: names.school(picked).name }) : t("Kaplan degrees")}
                <span className="pw-count">{kaplanRows.length}</span>
              </h2>
              <div className="pw-filters">
                <button type="button" className={`chip${topUpOnly ? " is-on" : ""}`} aria-pressed={topUpOnly} onClick={() => setTopUpOnly(!topUpOnly)}>
                  {t("Top-up only")}
                </button>
                <button type="button" className={`chip${allFields ? " is-on" : ""}`} aria-pressed={allFields} onClick={() => setAllFields(!allFields)}>
                  {t("All fields")}
                </button>
                {picked && (
                  <button type="button" className="chip is-on" aria-pressed="true" onClick={() => setPicked(null)}>
                    {names.school(picked).name} <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            </div>
            <ul className="tu-list">
              {kaplanRows.map(({ t: x, checks, state }) => {
                const on = !!x.kaplanId && x.kaplanId === answers.pathwayDegreeId;
                const f = fee(x);
                const sch = uniScholarships(x);
                return (
                  <li key={x.id} className={`tu-card is-${state}${on ? " is-on" : ""}`}>
                    <div className="tu-head">
                      <span className="pw-tag">{t(x.route ? ROUTE[x.route] : "Degree")}</span>
                      {x.cscse && <span className={`pw-tag${x.cscse.pair ? " is-cscse" : ""}`}>{x.cscse.pair ? t("CSCSE · since {date}", { date: ym(x.cscse.from) }) : t("CSCSE: check university")}</span>}
                    </div>
                    <h3 className="tu-name">{names.degree(x.name).name}</h3>
                    {names.degree(x.name).en && <p className="rx-card-en">{x.name}</p>}
                    <p className="tu-uni">{x.university && names.school(x.university).name}</p>
                    <dl className="tu-facts">
                      <div>
                        <dt>{t("Length")}</dt>
                        <dd>{x.months ? t("{n} months", { n: months(x.months) }) : "–"}</dd>
                      </div>
                      <div>
                        <dt>{t("Fee")}</dt>
                        <dd>
                          {f
                            ? `≈ ${k(f)}`
                            : bg.studentPass && x.doubleMajors.some((d) => d.fee)
                              ? t("Double major ≈ {fee}", { fee: k(Math.min(...x.doubleMajors.flatMap((d) => (d.fee ? [d.fee] : [])))) })
                              : bg.studentPass && x.access === "part-time-only"
                                ? t("Part-time only")
                                : bg.studentPass && x.international === false
                                  ? t("Local only")
                                  : "–"}
                        </dd>
                      </div>
                      <div className="tu-starts">
                        <dt>{t("Starts")}</dt>
                        <dd>{x.intake ? <MonthDots mask={x.intake} /> : "–"}</dd>
                      </div>
                    </dl>
                    <Pills checks={checks} />
                    {bg.studentPass && x.doubleMajors.length > 0 && (
                      <details className="rx-quote tu-doubles">
                        <summary>{t("Open to international students as a double major ({n})", { n: x.doubleMajors.length })}</summary>
                        <p>{t("Kaplan lists this single major for local applicants only. On a Student’s Pass you take it full time as a double major, which Kaplan opens to local and international applicants:")}</p>
                        <ul>
                          {x.doubleMajors.map((d) => (
                            <li key={d.url}>
                              <a href={d.url} target="_blank" rel="noopener noreferrer">
                                {names.degree(d.name).name}
                              </a>
                              {d.fee ? <span className="tu-doubles-fee" title={d.feeText ?? undefined}>≈ {k(d.fee)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {x.coreModules.length > 0 && (
                      <div className="tu-modules">
                        <p className="tu-label">{t("Core modules")}</p>
                        <ul>
                          {x.coreModules.slice(0, 6).map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                          {x.coreModules.length > 6 && <li className="is-more">+{x.coreModules.length - 6}</li>}
                        </ul>
                      </div>
                    )}
                    {(x.grants.length > 0 || sch.length > 0) && (
                      <ul className="tu-grants" aria-label={t("Scholarships and grants")}>
                        {sch.map((s) => (
                          <li key={s.id} title={`${s.title}: ${s.value}${s.places ? ` · ${s.places}` : ""}`}>
                            {s.short}
                          </li>
                        ))}
                        {[...new Set(x.grants.map((g) => grantLabel(g, t)))].slice(0, 2).map((g, i) => (
                          <li key={i} title={x.grants[i]}>
                            {g}
                          </li>
                        ))}
                      </ul>
                    )}
                    <details className="rx-quote">
                      <summary>{t("Requirement, in their words")}</summary>
                      <blockquote>
                        {[...x.qualifications, x.fieldRequirement, x.workExperience, ...x.english]
                          .filter((l): l is string => !!l)
                          .map((l, i) => (
                            <span key={i} className="tu-quote-line">
                              {l}
                            </span>
                          ))}
                      </blockquote>
                    </details>
                    <div className="tu-actions">
                      {x.kaplanId && (
                        <button
                          type="button"
                          className={`chip${on ? " is-on" : ""}`}
                          aria-pressed={on}
                          onClick={() => {
                            update({ pathwayDegreeId: on ? null : x.kaplanId, level: "diploma" });
                            jump.current = !on;
                          }}
                        >
                          {on ? t("Planned") : t("Plan with this")}
                        </button>
                      )}
                      <a href={x.url} target="_blank" rel="noopener noreferrer" className="pw-tile-link">
                        {t("Kaplan page")}
                        <span className="visually-hidden">: {names.degree(x.name).name}</span> <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
            {kaplanRows.length === 0 && <p className="notice">{t("No Kaplan degree in this field yet. Try “All fields”.")}</p>}
          </section>

          {otherProviders.length > 0 && (
            <section className="pw-options pw-others" aria-labelledby="pw-others-title">
              <div className="pw-options-head">
                <h2 id="pw-others-title">
                  {t("At other Singapore schools")}
                  <span className="pw-count">{others.length}</span>
                </h2>
              </div>
              {otherProviders.map((p) => {
                const rows = others.filter((x) => x.t.provider === p).sort((a, b) => byMatch(a, b) || a.t.name.localeCompare(b.t.name));
                const s = schools.find((x) => x.id === p);
                return (
                  <details key={p} className="pw-school">
                    <summary>
                      <span className="pw-school-name">{rows[0].t.providerName}</span>
                      <span className="rx-sub">
                        {t(rows.length === 1 ? "{n} degree" : "{n} degrees", { n: rows.length })}
                        {s?.cscseFrom ? ` · ${t("CSCSE since {date}", { date: ym(s.cscseFrom) })}` : ` · ${t("not on CSCSE’s list")}`}
                      </span>
                    </summary>
                    <div className="table-scroll">
                      <table className="data-table pw-table">
                        <thead>
                          <tr>
                            <th scope="col">{t("Degree")}</th>
                            <th scope="col">{t("University")}</th>
                            <th scope="col">{t("Length")}</th>
                            <th scope="col">{t("Fee")}</th>
                            <th scope="col">{t("Your background")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ t: x, checks, state }) => {
                            const f = fee(x);
                            return (
                              <tr key={x.id}>
                                <th scope="row">
                                  <a href={x.url} target="_blank" rel="noopener noreferrer">
                                    {names.degree(x.name).name}
                                  </a>
                                  {x.route === "top-up" && <span className="pw-tag">{t("Top-up")}</span>}
                                </th>
                                <td>{x.university ? names.school(x.university).name : "–"}</td>
                                <td>{x.months ? t("{n} mo", { n: months(x.months) }) : "–"}</td>
                                <td>{f ? `≈ ${k(f)}` : "–"}</td>
                                <td>
                                  <span className={`rx-pill ${PILL[state]}`} title={checks.map((c) => `${t(c.label)}${c.quote ? `: ${c.quote}` : ""}`).join("\n")}>
                                    <span className="rx-check-mark" aria-hidden="true">
                                      {MARK[state]}
                                    </span>
                                    <span className="rx-pill-need">
                                      {state === "met" ? t("Meets listed entry") : state === "check" ? t("To check") : t(checks.find((c) => c.state === "not")?.label ?? "")}
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </section>
          )}
        </>
      )}

      <div className="plan-actions" ref={actionsRef}>
        {chosen ? (
          <Link href="/results" className="button button-solid">
            {t("Next: programmes for you")} <ArrowRightIcon className="arrow" size={18} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pw-hint">{t("Plan with a Kaplan degree to continue")}</span>
        )}
      </div>
    </div>
  );
}
