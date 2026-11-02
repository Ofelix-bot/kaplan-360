import { BadgeCheckIcon, ChartNoAxesColumnIncreasingIcon, GraduationCapIcon, TrendingUpIcon, WalletIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { sgd } from "@/components/careers/format";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import type { FactRow, RoleFull } from "@/lib/careers/types";
import { getT } from "@/lib/i18n/server";
import type { ReceiptView } from "@/lib/receipts/model";
import { FigureText } from "./FigureText";

// The role page's demand (plan §3.2): one big-number card per signal the data holds, and nothing for a
// signal it does not: the role's vacancy rank in MOM's Job Vacancies 2025 for its industry, the COMPASS
// Shortage Occupation List (the EP list), MOM's fresh-graduate vacancies and starting pay, and trend
// figures from the reports. Each card: an amber dash, the value (a rank as "#3", other figures in the
// source's words through FigureText), its label in full, the footnote.
// The section is left out when the role has no demand fact.

const C = DRAFT.careers;

/** `figure`: the source's own words, set by FigureText. Otherwise a value we formatted ("#1", "S$4,600 – S$7,600"). */
type Card = { key: string; icon: LucideIcon; value: string; figure?: boolean; label: string; factId: string; labelLang?: string };

/** A metric's trailing ": rank" says what the "#N" above it already says. */
const metricLabel = (metric: string) => metric.replace(/:\s*rank$/i, "");

const H2 = "m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,34px)] leading-[1.12] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

function range(f: FactRow): string | null {
  const lo = f.figures?.low;
  const hi = f.figures?.high;
  if (lo == null || hi == null) return null;
  return `${sgd(lo)} – ${sgd(hi)}`;
}

/** The demand facts of a role, in card order. */
function demandOf(role: RoleFull) {
  const order = ["mom-needs-jv", "mom-needs-sol", "entry-vacancy", "trend"] as const;
  return role.facts.filter((f) => (order as readonly string[]).includes(f.use)).sort((a, b) => order.indexOf(a.use as (typeof order)[number]) - order.indexOf(b.use as (typeof order)[number]));
}

/** The views this section numbers, in reading order. */
export function demandViews(role: RoleFull, receipts: Record<string, ReceiptView>): ReceiptView[] {
  const seen = new Set<string>();
  return demandOf(role)
    .map((f) => f.factId)
    .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
    .map((id) => receipts[id])
    .filter((v): v is ReceiptView => !!v);
}

export async function DemandSignals({ role, receipts, className }: { role: RoleFull; receipts: Record<string, ReceiptView>; className?: string }) {
  const t = await getT();
  const cards: Card[] = [];
  for (const { use, factId, fact } of demandOf(role)) {
    if (use === "mom-needs-jv") {
      const rank = fact.figures?.rank;
      if (rank != null) cards.push({ key: `${factId}-jv`, icon: ChartNoAxesColumnIncreasingIcon, value: `#${rank}`, label: t(C.role.jvRank), factId });
      else cards.push({ key: `${factId}-jv`, icon: ChartNoAxesColumnIncreasingIcon, value: fact.value, figure: true, label: fact.metric, factId, labelLang: "en" });
    } else if (use === "mom-needs-sol") {
      cards.push({ key: `${factId}-sol`, icon: BadgeCheckIcon, value: t(C.badges.momNeedsSol), figure: true, label: t(C.role.sol), factId });
    } else if (use === "entry-vacancy") {
      const v = fact.figures?.vacancies;
      if (v != null) cards.push({ key: `${factId}-vac`, icon: GraduationCapIcon, value: v.toLocaleString("en-SG"), label: t(C.role.freshVacancies), factId });
      const pay = range(fact);
      if (pay) cards.push({ key: `${factId}-pay`, icon: WalletIcon, value: pay, label: t(C.role.startPay), factId });
      if (v == null && !pay) cards.push({ key: `${factId}-val`, icon: GraduationCapIcon, value: fact.value, figure: true, label: fact.metric, factId, labelLang: "en" });
    } else {
      const rank = fact.figures?.rank;
      cards.push({ key: `${factId}-trend`, icon: TrendingUpIcon, value: rank != null ? `#${rank}` : fact.value, figure: rank == null, label: metricLabel(fact.metric), factId, labelLang: "en" });
    }
  }
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="cr-demand-title" className={cn("home-wrap flex flex-col gap-6 border-t border-(--land-line) py-12 sm:py-14", className)}>
      <h2 id="cr-demand-title" className={H2}>
        {t(C.role.demandTitle)}
      </h2>
      <ReceiptSection receipts={demandViews(role, receipts)}>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.key} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-(--land-line) bg-(--land-card) p-5">
                <span aria-hidden className="h-[3px] w-8 rounded-full bg-(--accent)" />
                <p className="m-0 flex min-w-0 items-start gap-1 font-heading text-[clamp(24px,2.6vw,36px)] leading-[1.05] font-bold tabular-nums wrap-break-word text-(--text)">
                  {c.figure ? <FigureText value={c.value} className="min-w-0" /> : <span className="min-w-0">{c.value}</span>}
                  <Fn id={c.factId} />
                </p>
                <p lang={c.labelLang} className="m-0 inline-flex min-w-0 items-start gap-1.5 text-[14px] leading-snug text-(--land-body)">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-(--brand-ink)" />
                  {/* In full: a clamp lays its hidden lines over the card's padding (Hallmark 72). */}
                  <span className="min-w-0">{c.label}</span>
                </p>
              </li>
            );
          })}
        </ul>
        <SourceList className="mt-6" />
      </ReceiptSection>
    </section>
  );
}
