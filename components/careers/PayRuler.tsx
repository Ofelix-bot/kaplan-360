import { BanknoteIcon, MegaphoneIcon } from "lucide-react";
import { cn } from "cn";
import { sgd } from "@/components/careers/format";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import type { RoleFull } from "@/lib/careers/types";
import { getT } from "@/lib/i18n/server";
import { fromRule, type ReceiptView } from "@/lib/receipts/model";

// The role page's pay (plan §3.2; Q13: no table): one ruler for MOM's Occupational Wages 2025 (25th
// percentile, median, 75th percentile of gross monthly pay), from the sheet of the industry's MOM group,
// else the all-industries sheet, and the line under it says which. A second, separate bar shows the
// Jobstreet advertised range where the role is matched to one, with Jobstreet's own caveat. Both bars share
// one scale, so their positions compare. Every figure is set as S$ with separators (a table cell prints
// "7450", an ad "4,600–7,600"); the receipt quotes the source's own form. Every number carries its
// footnote; our joins (MOM group, MOM occupation, ad match, high pay) are footnoted to their rule
// sentences. Static: nothing moves.

const C = DRAFT.careers;

type Link = RoleFull["facts"][number];

/** The role's wage fact: the industry's own sheet first, then the all-industries one. */
function wageOf(role: RoleFull): Link | null {
  const wages = role.facts.filter((f) => f.use === "wage" && (f.fact.figures?.median != null || f.fact.valueNum != null));
  return wages.find((f) => f.fact.industryId === role.industryId) ?? wages.find((f) => f.fact.industryId === null) ?? wages[0] ?? null;
}

function adOf(role: RoleFull): Link | null {
  return role.facts.find((f) => f.use === "ad-salary" && f.fact.figures?.low != null && f.fact.figures?.high != null) ?? null;
}

/** Receipt ids of our own joins on this ruler. */
export const payRuleIds = (role: Pick<RoleFull, "id" | "industryId">) => ({
  momMap: `rule:mom-map:${role.industryId}`,
  ssoc: `rule:ssoc:${role.id}`,
  highPay: `rule:high-pay:${role.industryId}`,
  adMatch: `rule:ad-match:${role.id}`,
});

/** The views this section numbers, in reading order. Exported so a caller can list them elsewhere. */
export function payViews(role: RoleFull, receipts: Record<string, ReceiptView>): ReceiptView[] {
  const wage = wageOf(role);
  const ad = adOf(role);
  const ids = payRuleIds(role);
  const out: (ReceiptView | null | undefined)[] = [];
  if (wage) {
    // The line above the ruler (MOM group, MOM occupation), then the figures (wage, high pay).
    if (wage.fact.industryId !== null && role.industry.momBasis) out.push(fromRule(ids.momMap, role.industry.momBasis));
    const ssoc = wage.basis ?? role.ssocBasis;
    if (ssoc) out.push(fromRule(ids.ssoc, ssoc));
    out.push(receipts[wage.factId]);
    if (role.highPay && role.highPayRule) out.push(fromRule(ids.highPay, role.highPayRule));
  }
  if (ad) {
    if (ad.basis) out.push(fromRule(ids.adMatch, ad.basis));
    out.push(receipts[ad.factId]);
  }
  return out.filter((v): v is ReceiptView => !!v);
}

const H2 = "m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,34px)] leading-[1.12] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

/** One figure under the ruler: value, label, footnote. */
function Figure({ value, label, factId, strong = false, extra }: { value: string; label: string; factId: string; strong?: boolean; extra?: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", strong ? "items-center text-center" : "")}>
      <span aria-hidden className="h-[3px] w-8 rounded-full bg-(--accent)" />
      <p className={cn("m-0 font-heading leading-none font-bold tabular-nums text-(--text)", strong ? "text-[clamp(18px,5vw,44px)] sm:text-[clamp(28px,3.4vw,44px)]" : "text-[clamp(14px,4.1vw,28px)] sm:text-[clamp(20px,2.2vw,28px)]")}>
        {value}
        <Fn id={factId} />
      </p>
      <p className="m-0 text-[14px] leading-snug text-(--land-body)">{label}</p>
      {extra}
    </div>
  );
}

export async function PayRuler({ role, receipts, className }: { role: RoleFull; receipts: Record<string, ReceiptView>; className?: string }) {
  const t = await getT();
  const wage = wageOf(role);
  const ad = adOf(role);
  if (!wage && !ad) return null;
  const ids = payRuleIds(role);
  const views = payViews(role, receipts);

  const w = wage?.fact.figures ?? null;
  const median = w?.median ?? wage?.fact.valueNum ?? null;
  const p25 = w?.p25 ?? null;
  const p75 = w?.p75 ?? null;
  const lowAd = ad?.fact.figures?.low ?? null;
  const highAd = ad?.fact.figures?.high ?? null;

  // One scale for both bars, with a margin either side.
  const nums = [p25, median, p75, lowAd, highAd].filter((n): n is number => n != null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = Math.max((max - min) * 0.12, max * 0.05, 1);
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const pos = (n: number) => `${(((n - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const span = (a: number, b: number) => ({ left: pos(a), width: `${(((b - a) / (hi - lo)) * 100).toFixed(2)}%` });

  const industryLine = wage && wage.fact.industryId !== null ? t(C.role.payIndustry, { industry: role.industry.momIndustry ?? wage.fact.sourceIndustry ?? role.industry.short }) : t(C.role.payAll);
  const ssoc = wage ? (wage.basis ?? role.ssocBasis) : null;

  return (
    <section aria-labelledby="cr-pay-title" className={cn("home-wrap flex flex-col gap-6 border-t border-(--land-line) py-12 sm:py-14", className)}>
      <h2 id="cr-pay-title" className={H2}>
        {t(C.role.payTitle)}
      </h2>
      <ReceiptSection receipts={views}>
        <div className="flex flex-col gap-8 rounded-2xl border border-(--land-line) bg-(--land-card) p-5 sm:p-7">
          {wage && median != null && (
            <div className="flex flex-col gap-5">
              <p className="m-0 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-snug font-semibold text-(--text)">
                <BanknoteIcon aria-hidden className="size-4 shrink-0 text-(--brand-ink)" />
                <span lang="en">{industryLine}</span>
                {wage.fact.industryId !== null && role.industry.momBasis ? <Fn id={ids.momMap} /> : null}
                {ssoc ? <Fn id={ids.ssoc} /> : null}
              </p>
              {/* The ruler: the p25–p75 band and the median mark. Decorative: the figures below say it. */}
              <div aria-hidden className="relative h-3 rounded-full bg-(--land-line)">
                {p25 != null && p75 != null && <span className="absolute inset-y-0 rounded-full bg-(--brand-ink)/30" style={span(p25, p75)} />}
                <span className="absolute -top-2 h-7 w-[3px] -translate-x-1/2 rounded-full bg-(--brand-ink)" style={{ left: pos(median) }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {p25 != null ? <Figure value={sgd(p25)} label={t(C.role.p25)} factId={wage.factId} /> : <span />}
                <Figure
                  value={sgd(median)}
                  label={t(C.role.median)}
                  factId={wage.factId}
                  strong
                  extra={
                    role.highPay && role.highPayRule ? (
                      <p className="m-0 text-[13px] leading-snug font-semibold text-(--brand-ink)">
                        {t(C.badges.highPay)}
                        <Fn id={ids.highPay} />
                      </p>
                    ) : null
                  }
                />
                {p75 != null ? (
                  <div className="flex justify-end text-right">
                    <Figure value={sgd(p75)} label={t(C.role.p75)} factId={wage.factId} />
                  </div>
                ) : (
                  <span />
                )}
              </div>
            </div>
          )}

          {ad && lowAd != null && highAd != null && (
            <div className="flex flex-col gap-3 border-t border-(--land-line) pt-6">
              <p className="m-0 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-snug font-semibold text-(--text)">
                <MegaphoneIcon aria-hidden className="size-4 shrink-0 text-(--accent-ink)" />
                {t(C.role.advertised)}
                {ad.basis ? <Fn id={ids.adMatch} /> : null}
              </p>
              <div aria-hidden className="relative h-3 rounded-full bg-(--land-line)">
                <span className="absolute inset-y-0 rounded-full bg-(--accent)" style={span(lowAd, highAd)} />
              </div>
              <p className="m-0 font-heading text-[clamp(20px,2.2vw,28px)] leading-none font-bold tabular-nums text-(--text)">
                {sgd(lowAd)} – {sgd(highAd)}
                <Fn id={ad.factId} />
              </p>
              <p className="m-0 text-[14px] leading-snug text-(--land-body)">{t(C.role.advertisedNote)}</p>
            </div>
          )}
        </div>
        <SourceList className="mt-6" />
      </ReceiptSection>
    </section>
  );
}
