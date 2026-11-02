import type { ReactNode } from "react";
import { getLocale, getT } from "@/lib/i18n/server";
import { schoolName } from "@/lib/site-names";
import { msg } from "@/lib/i18n/translate";
import type { AlgorithmFacts } from "@/lib/algorithm/facts";
import { Calculator, type CalcProps } from "./calculator";
import { CoefChart, DeltaChart, DialsChart, RangeChart, ShareChart, TierChart } from "./charts";

// /algorithm, the Core Algorithm page: the calculator first, then the ten steps behind the match rate, the backtest
// and what is not done yet. Every number is read from the model at build time (lib/algorithm/facts.ts).

const n = (v: number) => v.toLocaleString("en-SG");
const p0 = (v: number) => `${Math.round(v * 100)}%`;
const p1 = (v: number) => `${(v * 100).toFixed(1)}%`;
/** Two decimals with its sign: −0.11, +0.03. */
const signed = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}`;

function Step({ id, no, title, children }: { id: string; no: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 gap-x-10 gap-y-4 border-t border-(--land-line) pt-10 lg:grid-cols-[4rem_minmax(0,1fr)]">
      <span aria-hidden className="font-heading text-3xl leading-none font-bold text-(--brand-ink) tabular-nums">
        {no}
      </span>
      <div className="flex min-w-0 flex-col gap-4">
        <h2 id={`${id}-title`} className="m-0 font-heading text-2xl font-bold tracking-[-0.01em] text-pretty sm:text-3xl">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="m-0 max-w-[68ch] text-[15px] leading-relaxed text-(--land-body)">{children}</p>;
const B = (chunk: ReactNode) => <strong className="font-semibold text-(--text)">{chunk}</strong>;
const Formula = ({ children }: { children: ReactNode }) => (
  <p className="m-0 self-start overflow-x-auto rounded-lg border border-(--land-line) bg-(--land-card) px-3 py-2 font-mono text-[13px] text-(--text)">{children}</p>
);
const Figure = ({ children }: { children: ReactNode }) => <div className="rounded-2xl border border-(--land-line) bg-(--land-card) p-4 sm:p-5">{children}</div>;

/** Label · value rows. */
function Stats({ rows, label }: { rows: [ReactNode, ReactNode][]; label: string }) {
  return (
    <dl aria-label={label} className="m-0 grid gap-px overflow-hidden rounded-xl border border-(--land-line) bg-(--land-line) sm:grid-cols-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 bg-(--land-card) px-3 py-2.5 sm:odd:last:col-span-2">
          <dt className="text-sm text-(--land-body)">{k}</dt>
          <dd className="m-0 font-heading text-lg font-bold text-(--text) tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const STEPS = [
  ["s1", msg("One scale")], ["s2", msg("Programme curve")], ["s3", msg("Kaplan degree")], ["s4", msg("Ranges")], ["s5", msg("Elite programmes")],
  ["s6", msg("Programmes without cases")], ["s7", msg("Career value")], ["s8", msg("Policy risk")], ["s9", msg("UK offer rates")], ["s10", msg("External checks")],
] as const;

export async function AlgorithmPage({ f }: { f: AlgorithmFacts }) {
  const t = await getT();
  const locale = await getLocale();
  const uni = (en: string) => schoolName(locale, en).name;
  const calc: CalcProps = { partners: f.partners, deltaSd: f.delta.sd, thetaSe: f.thetaSe };
  const aTier = f.tierShift.A;
  const kaplanShift = aTier + f.delta.mu;
  const exp = Object.fromEntries(f.experience.map((e) => [e.cls, e]));
  const fb = Object.fromEntries(f.floorBand.map((b) => [b.country, b]));
  const partnersA = f.partners.filter((p) => p.tier === "A");
  const partnersC = f.partners.filter((p) => p.tier === "C");

  return (
    <div className="ui min-h-svh bg-(--land-ground) text-foreground">
      <div className="home-wrap flex flex-col gap-12 pt-[80px] pb-20 sm:pt-[112px] sm:pb-28">
        <header className="flex flex-col gap-4">
          <h1 className="m-0 font-heading text-[32px] leading-tight font-bold tracking-[-0.02em] sm:text-5xl">{t("Core Algorithm")}</h1>
          <p className="m-0 max-w-[40ch] font-heading text-xl font-semibold text-pretty text-(--text) sm:text-2xl">{t("How closely does a Kaplan student match this programme?")}</p>
          <P>
            {t(
              "Every number comes from comparing private-institution students’ outcomes with applicants as a whole: {records} applicant records split by first-degree tier; {external} records from public datasets that match a programme, of which {rows} offers and rejections set the curve shape; data from {kaplan} Kaplan students, drawn from Singapore private-institution students’ application reports, as the core algorithm’s base; Oxford’s and Cambridge’s admissions statistics; UK universities’ Freedom of Information replies matched to {foi} programmes; QS 2026 and ShanghaiRanking GRAS 2025 subject rankings; and, for MBAs, schools’ reported acceptance rates. All {programmes} programmes in the library have parameters.",
              { records: n(f.sources.records), external: n(f.sources.external), rows: n(f.sources.curveRows), kaplan: f.sources.kaplanStudents, foi: n(f.sources.foiProgrammes), programmes: n(f.sources.programmes) },
            )}
          </P>
          <nav aria-label={t("The ten steps")} className="flex flex-wrap gap-1.5">
            {STEPS.map(([id, label], i) => (
              <a key={id} href={`#${id}`} className="inline-flex items-center gap-1.5 rounded-full border border-(--land-line) bg-(--land-card) px-2.5 py-1 text-xs font-medium text-(--text) hover:border-(--brand-ink)">
                <span className="font-bold text-(--brand-ink) tabular-nums">{i + 1}</span>
                {t(label)}
              </a>
            ))}
          </nav>
        </header>

        <section aria-label={t("Try it")} className="flex flex-col gap-3">
          <Calculator {...calc} />
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
            {[
              ["bg-(--land-no-bg) text-(--land-no)", msg("Below 30% · Gap to close"), msg("Hard requirements still to make up.")],
              ["bg-(--land-check-bg) text-(--land-check)", msg("30–60% · In range"), msg("Within the application range; add to the profile to compete.")],
              ["bg-(--land-ok-bg) text-(--land-ok)", msg("Above 60% · Strong position"), msg("Keep it up; success is within reach.")],
            ].map(([cls, head, body]) => (
              <li key={head} className={`rounded-xl px-3 py-2.5 text-sm ${cls}`}>
                <strong className="block font-semibold">{t(head)}</strong>
                {t(body)}
              </li>
            ))}
          </ul>
        </section>

        <Step id="s1" no="01" title={t("Put everyone on one scale")}>
          <P>
            {t.rich(
              "On the same programme, students from stronger first-degree universities are admitted with lower GPAs. The median admitted GPA of A-tier graduates is <b>{a}</b> below that of C-tier graduates, and B-tier is <b>{b}</b> below (measured on {na} and {nb} programmes with enough of each). So every GPA gets its tier’s shift, giving a “C-tier-equivalent” GPA, and the three tiers’ admits line up.",
              { b: B },
              { a: f.tierShift.A.toFixed(2), b: f.tierShift.B.toFixed(2), na: f.tierCounts?.[0] ?? "–", nb: f.tierCounts?.[1] ?? "–" },
            )}
          </P>
          <Formula>{`C-tier equivalent = GPA + { A: ${f.tierShift.A.toFixed(2)}, B: ${f.tierShift.B.toFixed(2)}, C: 0 }`}</Formula>
          <Figure>
            <TierChart gaps={f.tierGaps} shift={f.tierShift} />
          </Figure>
        </Step>

        <Step id="s2" no="02" title={t("One curve per programme, three dials")}>
          <P>
            {t.rich(
              "<b>θ threshold</b>: the 25th percentile of admitted students on the common scale. <b>s slope</b>: the narrower the admitted range, the steeper the curve. <b>c ceiling</b>: the rate for an applicant well above the threshold.",
              { b: B },
            )}
          </P>
          <Formula>match = c × sigmoid((C-tier equivalent − θ) / s)</Formula>
          <Figure>
            <DialsChart />
          </Figure>
          <P>
            {t.rich("<b>Floor</b>: the minimum class each programme states ({n} programmes state one). Below it, the programme is shown as not met.", { b: B }, { n: n(f.floors) })}
          </P>
          <P>
            {t.rich(
              "<b>Floor band</b>: on programmes whose minimum is a 2:2, the share of admits with a 2:2 against their share among all admits in that country: UK {uk} (capped at 1: meeting the floor is usually enough), Australia {au}, Hong Kong {hk}, Singapore {sg}. An applicant at or above the floor never gets less than this band’s rate.",
              { b: B },
              { uk: fb["United Kingdom"]?.ratio.toFixed(2) ?? "–", au: fb.Australia?.factor.toFixed(2) ?? "–", hk: fb["Hong Kong SAR"]?.factor.toFixed(2) ?? "–", sg: fb.Singapore?.factor.toFixed(2) ?? "–" },
            )}
          </P>
        </Step>

        <Step id="s3" no="03" title={t("What a Kaplan degree is worth: δ")}>
          <P>
            {t(
              "A Kaplan degree is awarded by a partner university, so it starts from that university’s tier: {a} are A tier, worth +{shift}; {c} are C tier, worth 0.",
              { a: partnersA.map((p) => `${uni(p.name)} (QS ${p.qs})`).join(locale === "en" ? ", " : "、"), shift: aTier.toFixed(2), c: partnersC.map((p) => uni(p.name)).join(locale === "en" ? ", " : "、") },
            )}
            {locale === "en" ? " " : ""}
            {t(
              "Based on the data so far, the difference in final application outcomes between studying at Kaplan and completing the degree at the partner university is within statistical error (gap {gap} GPA points, 95% range {low} to {high}).",
              { gap: signed(f.delta.mu), low: signed(f.delta.range95[0]), high: signed(f.delta.range95[1]) },
            )}
          </P>
          <P>
            {t.rich(
              "Then only the data speaks. Each private-institution student’s offer is compared with the same programme’s admits, which shows what shift would put that student among them. The {n} offers together put a degree from an A-tier partner at <b>+{v}</b>, about B tier; a degree from a C-tier partner stays at C.",
              { b: B },
              { n: f.delta.n, v: kaplanShift.toFixed(2) },
            )}
          </P>
          <Figure>
            <DeltaChart delta={f.delta} top={aTier} />
          </Figure>
          <P>{t("Hover a dot for its programme. Outliers such as an offer made with a Pass are handled by a robust likelihood rather than removed by hand.")}</P>
        </Step>

        <Step id="s4" no="04" title={t("Uncertainty becomes a range")}>
          <P>{t("The threshold θ is uncertain (more so with few admits), and so are the ceiling c and the shift δ. Each calculation draws 3,000 sets of them and gets 3,000 match rates. The chart shows them for the calculator’s current settings; the shading is the 80% range.")}</P>
          <Figure>
            <RangeChart {...calc} />
          </Figure>
        </Step>

        <Step id="s5" no="05" title={t("How “elite” is defined and handled")}>
          <P>
            {t.rich(
              "<b>Competitiveness K</b> = the median admitted GPA on the common scale. Across {n} programmes with at least 10 reported admits, the higher K, the smaller the share of admits from C-tier universities: {low} below K 3.4, {high} at K 3.9 and above, where {none} of {top} programmes have none.",
              { b: B },
              { n: f.elite.shares.programmes, low: p0(f.elite.shares.below34), high: p0(f.elite.shares.top39), none: f.elite.shares.topNone, top: f.elite.shares.topProgrammes },
            )}
          </P>
          <P>
            {t.rich(
              "<b>Elite</b> = K ≥ {k}, the band C-tier graduates almost never reach, or {ratio}+ official applications per place, or an official offer rate as low. {count} programmes are elite. Their ceiling is 3 × the offer rate, capped at 0.9.",
              { b: B },
              { k: f.elite.k, ratio: f.elite.ratio, count: n(f.elite.count) },
            )}
          </P>
          <P>
            {t.rich(
              "<b>Background factor</b>: the fitted C-tier share at the programme’s K divided by the share at K 3.8. Below 3.8 it is 1, because the tier shift already covers the gap; above it the 4.0 cap squeezes GPAs together, so background shows up as fewer C-tier admits instead: {a} at K 3.9, {b} at K 4.05.",
              { b: B },
              { a: f.elite.bg39.toFixed(2), b: f.elite.bg405.toFixed(2) },
            )}
          </P>
          <Figure>
            <ShareChart elite={f.elite} />
          </Figure>
          <h3 className="m-0 font-heading text-lg font-bold">{t("MBAs")}</h3>
          <P>
            {t(
              "MBAs admit on work experience and tests more than on grades, so a GPA curve alone rates them far too high. {n} full-time MBA programmes take their school’s reported acceptance rate, and their ceiling is {x} × that rate, capped at 0.9: an applicant at the class median then sits near 1.3 × the rate. Other MBAs in the United States and Canada keep a ceiling of 0.8.",
              { n: f.mba.programmes, x: f.mba.ceilingX },
            )}
          </P>
          <div className="max-w-2xl overflow-x-auto rounded-xl border border-(--land-line) bg-(--land-card)">
            <table className="w-full min-w-[22rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-(--land-body)">
                  <th className="px-3 py-2 font-medium">{t("School")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Acceptance rate")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Ceiling")}</th>
                </tr>
              </thead>
              <tbody>
                {f.mba.rows.map((r) => (
                  <tr key={r.school} className="border-t border-(--land-line)">
                    <td className="px-3 py-1.5" lang="en">
                      {r.school}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p1(r.rate)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{r.ceiling.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-xs text-(--land-body)">
            {t("Fall 2025 entry. {source}.", { source: f.mba.source })}{" "}
            <a href={f.mba.url} className="font-medium text-(--brand-ink) underline-offset-4 hover:underline" rel="noreferrer" target="_blank">
              {t("Source")}
            </a>
          </p>
        </Step>

        <Step id="s6" no="06" title={t("Filling in programmes without cases")}>
          <P>
            {t(
              "{cases} programmes with reported outcomes teach the model what makes a programme demanding; it then predicts the other {pred}. Tested on universities it had not seen, its error is {err} GPA points, against {base} for the plain average. Programmes with reported outcomes blend their own figures with the prediction, trusting their own more as the cases grow.",
              { cases: n(f.prediction.withCases), pred: n(f.prediction.predicted), err: f.prediction.cv[0].toFixed(2), base: f.prediction.cv[1].toFixed(2) },
            )}
          </P>
          <Figure>
            <CoefChart rows={f.prediction.coefficients} />
          </Figure>
        </Step>

        <Step id="s7" no="07" title={t("Work experience and test scores")}>
          <P>{t("Each role = fit × employer standing × contribution, with internships at {d}. The best three roles count 1, ½ and ¼; the programme’s weight for experience turns that into GPA points.", { d: f.internDiscount })}</P>
          <Formula>bonus = weight × min(1, Σ rank weight × fit × standing × contribution × internship / 1.5)</Formula>
          <Stats
            label={t("Largest experience bonus, by what the programme asks for")}
            rows={[
              [t("MBA / Executive ({n})", { n: n(exp["mba-exec"].programmes) }), `+${exp["mba-exec"].weight}`],
              [t("Requires work experience ({n})", { n: n(exp.required.programmes) }), `+${exp.required.weight}`],
              [t("Prefers work experience ({n})", { n: n(exp.preferred.programmes) }), `+${exp.preferred.weight}`],
              [t("Other taught programmes"), `+${exp.none.weight}`],
            ]}
          />
          <h3 className="m-0 font-heading text-lg font-bold">{t("MBA and executive programmes: years of work")}</h3>
          <P>{t("Classes average about five years of work, and few admits come straight from a first degree, so the match rate is scaled by full-time work. This is Kaplan 360++’s rule, not a measured one.")}</P>
          <Stats label={t("Work years and the scale applied")} rows={[[t("2 years or more"), "× 1"], [t("1 year"), "× 0.5"], [t("Under 1 year, or not given"), "× 0.2"]]} />
          <P>
            {t(
              "GRE (verbal + quantitative): nothing up to 325; +0.01 GPA points for each point from 325 to 335, and +0.013 for each point above. Full weight where the programme requires it ({gf} programmes), half where it is optional or mentioned ({gh}). GMAT is read as a GRE score and scored the same way ({mf} require it, {mh} optional); if you have both, the higher counts.",
              { gf: n(f.tests.greFull), gh: n(f.tests.greHalf), mf: n(f.tests.gmatFull), mh: n(f.tests.gmatHalf) },
            )}
          </P>
          <P>{t("IELTS, a rule set by Kaplan 360++ (the data show no separate effect): elite programmes take 0.1 off below 7.5; other programmes add 0.05 at 1.5 or more above the university’s lowest minimum.")}</P>
        </Step>

        <Step id="s8" no="08" title={t("Policy risk: when the programme’s design itself may not work")}>
          <P>{t("Some limits have nothing to do with grades. Ireland lets non-EU students spend at most 90 days of a rolling year outside the country, while the CEMS term abroad lasts 12 to 16 weeks. Every programme carries risk flags by country, by its features and, where it matters, by the applicant’s nationality.")}</P>
          <Stats
            label={t("Programmes carrying each flag")}
            rows={[
              [t("May not work · Ireland 90-day absence"), n(f.policy["ie-absence-90"])],
              [t("May not work · US travel ban"), n(f.policy["us-travel-ban"])],
              [t("Check · UK ATAS"), n(f.policy["uk-atas"])],
              [t("High impact · UK Graduate Route cut to 18 months"), n(f.policy["uk-graduate-route-18m"])],
              [t("High impact · US visa social-media vetting"), n(f.policy["us-visa-vetting"])],
              [t("High impact · US scrutiny of Chinese STEM students"), n(f.policy["us-china-stem"])],
            ]}
          />
        </Step>

        <Step id="s9" no="09" title={t("UK ceilings from real offer rates")}>
          <P>{t("Admitted students show how GPA separates the people who got in, but not how many a programme turns away for lack of places. UK universities’ Freedom of Information replies give that directly: applications and offers per programme, matched to {n} programmes in the library.", { n: n(f.ukFoi.matched) })}</P>
          <P>{t("The ceiling now follows the programme: an applicant at the admitted median gets {m} × its offer rate. Programmes without a reply get a predicted offer rate; tested on universities it had not seen, its error is {err} against {base} for the plain average.", { m: f.ukFoi.m, err: f.ukFoi.cv.rmseRate, base: f.ukFoi.cv.baselineRmse })}</P>
          <Stats
            label={t("UK ceilings")}
            rows={[
              [t("Ceiling, programmes with a reply · before"), f.ukFoi.ceilings.before.toFixed(2)],
              [t("Ceiling, programmes with a reply · now (median)"), f.ukFoi.ceilings.withReply.toFixed(2)],
              [t("Ceiling, predicted programmes · now (median)"), f.ukFoi.ceilings.predicted.toFixed(2)],
            ]}
          />
        </Step>

        <Step id="s10" no="10" title={t("Checked against official statistics and independent research")}>
          <P>{t("Oxford’s and Cambridge’s published statistics show that {y} of taught-programme offers turn into enrolments, not the 65% first assumed. Asian applicants receive offers at {ox} of the rate for all applicants at Oxford and {cam} at Cambridge, the same range as the background factor of {bg} at K 3.9; it is recorded as a check rather than multiplied in again.", { y: p1(f.official.yield), ox: f.official.oxfordAsia?.toFixed(2) ?? "–", cam: f.official.cambridgeAsia?.toFixed(2) ?? "–", bg: f.elite.bg39.toFixed(2) })}</P>
          <P>{t("Hong Kong slope: a 2024 study of Hong Kong taught master’s applications found each extra point of a 100-point average multiplies the odds of an offer by {paper}. The model’s median over {n} Hong Kong programmes is {model}.", { paper: f.official.hk.paper.toFixed(3), n: f.official.hk.programmes, model: f.official.hk.model.toFixed(3) })}</P>
          <Stats
            label={t("Checks")}
            rows={[
              [t("Offers that enrol · first assumption"), "65%"],
              [t("Offers that enrol · Oxford and Cambridge"), p1(f.official.yield)],
              [t("Asian applicants’ offer rate ÷ all (Oxford)"), f.official.oxfordAsia?.toFixed(2) ?? "–"],
              [t("Background factor at K 3.9"), f.elite.bg39.toFixed(2)],
              [t("Hong Kong odds per point · study"), f.official.hk.paper.toFixed(3)],
              [t("Hong Kong odds per point · model"), f.official.hk.model.toFixed(3)],
            ]}
          />
        </Step>

        <Step id="backtest" no="✓" title={t("Checked against real Kaplan offers")}>
          <P>{t("Real Kaplan offers with grades that match a programme in the library, and the match rate the model gives each. All are offers, so this checks that the model does not underrate students who did get in; with no rejections yet, it cannot show whether it overrates anyone.")}</P>
          <Stats
            label={t("Backtest")}
            rows={[
              [t("Offers checked"), f.backtest.offers],
              [t("Median match rate"), p0(f.backtest.median)],
              [t("Put below 30%"), t("{n} of {total}", { n: f.backtest.below30, total: f.backtest.offers })],
            ]}
          />
        </Step>

        <Step id="todo" no="…" title={t("Not done yet")}>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {[
              [msg("No rejections for Hong Kong, Singapore or Australia"), msg("Offer boards hide GPAs behind log-ins, and handbooks hold only a few dozen rejections there. The Hong Kong slope agrees with independent research; Singapore and Australia have nothing outside to check against yet.")],
              [msg("Curve slope calibrated only for the US and Canada"), msg("Offers and rejections there show a gentle curve; elsewhere the slope still comes from admitted students.")],
              [msg("Australian “meet the minimum” programmes"), msg("Admission there is about clearing the line, not competition; they should form their own group.")],
              [msg("Ceilings outside the UK are still rules of thumb"), msg("3 × the offer rate for elite programmes and 0.8 for others; 21 US business schools’ MBAs now follow their reported acceptance rates. MBAs outside the US have none published.")],
            ].map(([head, body]) => (
              <li key={head} className="rounded-xl border border-(--land-line) bg-(--land-card) p-3">
                <strong className="block text-sm font-semibold text-(--text)">{t(head)}</strong>
                <span className="text-sm text-(--land-body)">{t(body)}</span>
              </li>
            ))}
          </ul>
        </Step>
      </div>
    </div>
  );
}
