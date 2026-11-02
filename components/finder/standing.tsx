"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { InfoTip } from "@/components/landing/move/InfoTip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useModel } from "@/components/workspace/model";
import { compassFor, CRITERIA, industryOf, subjectOf, UNIVERSITY_WIDE_SHARE, type Criterion } from "@/lib/finder/criteria";
import type { FinderRow } from "./use-finder";

// The finder's order and what it reads: the criteria to sort by (one, or several averaged), each programme's
// figure on the chosen ones, and the Singapore recognition badges (MOM's COMPASS top-tier list, professional
// registers), which are shown but never sort (decided 2026-11-02).

type T = ReturnType<typeof useT>;
type Pick2 = Pick<FinderRow, "p" | "u">;

export const CRITERION_LABEL: Record<Criterion, string> = {
  match: "Match rate",
  qs: "QS rank",
  fee: "Fee",
  subject: "Subject strength",
  industry: "Industry recognition",
};

/** "51–100" from the published "51-100". */
const band = (rank: string) => rank.replace("-", "–");

export function subjectText(t: T, r: Pick2) {
  const s = subjectOf(r);
  if (!s) return t("Not ranked in the subject");
  return s.subject ? t("{subject} {rank}", { subject: t(s.subject), rank: band(s.rank) }) : t("GRAS {rank}", { rank: band(s.rank) });
}

export function industryText(t: T, r: Pick2) {
  const i = industryOf(r);
  if (!i) return t("No data");
  const rank = i.rank ? t("Employers #{rank}", { rank: i.rank }) : t("Employers {score}", { score: Math.round(i.score) });
  return i.universityWide ? t("{rank} · university-wide", { rank }) : rank;
}

function valueText(t: T, c: Criterion, r: FinderRow) {
  switch (c) {
    case "match":
      return r.match ? t("Match {n}%", { n: Math.round(r.match.rate * 100) }) : t("Match: no data");
    case "qs":
      return r.u.qs ? `QS #${r.u.qs.replace(/^=/, "")}` : t("QS: unranked");
    case "fee":
      return r.p.feeSgd !== null ? t("S${n} a year", { n: r.p.feeSgd.toLocaleString("en-SG") }) : t("Fee: no data");
    case "subject":
      return subjectText(t, r);
    case "industry":
      return industryText(t, r);
  }
}

/** The criteria as toggles: any number on, never none. */
export function CriteriaBar({ value, onChange }: { value: Criterion[]; onChange: (c: Criterion[]) => void }) {
  const t = useT();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span id="finder-sort-label" className="shrink-0 text-sm text-muted-foreground">
        {t("Sort by")}
      </span>
      <div className="-mx-1 min-w-0 overflow-x-auto px-1 py-1">
        <ToggleGroup
          multiple
          aria-labelledby="finder-sort-label"
          value={value}
          onValueChange={(v) => (v as Criterion[]).length && onChange(v as Criterion[])}
          variant="outline"
          spacing={1.5}
          className="flex-nowrap"
        >
          {CRITERIA.map((c) => (
            <ToggleGroupItem
              key={c}
              value={c}
              className="h-10 rounded-full bg-card px-3.5 text-[14px] whitespace-nowrap data-pressed:border-foreground data-pressed:bg-foreground data-pressed:text-background"
            >
              {t(CRITERION_LABEL[c])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <InfoTip
        label={t("How the order works")}
        text={t(
          "One criterion sorts by itself. Several: each programme’s place on each, out of the programmes listed, averaged with equal weight. A programme with no figure goes last. Industry recognition is QS’s employer reputation in the subject; where QS has none, the university’s QS 2027 figure counts at {share}%.",
          { share: Math.round(UNIVERSITY_WIDE_SHARE * 100) },
        )}
      />
    </div>
  );
}

/** The programme's figure on each chosen criterion the card doesn't already show, or on all of them when several are chosen. */
export function StandingLine({ r, criteria }: { r: FinderRow; criteria: Criterion[] }) {
  const t = useT();
  const shown = criteria.length > 1 ? criteria : criteria.filter((c) => c === "subject" || c === "industry");
  if (!shown.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-label={t("Sorted by")}>
      {shown.map((c, i) => (
        <li key={c} className={cn("tabular-nums", i > 0 && "before:mr-3 before:text-muted-foreground before:content-['·']")}>
          <span className="sr-only">{t(CRITERION_LABEL[c])}: </span>
          {valueText(t, c, r)}
        </li>
      ))}
    </ul>
  );
}

const BADGE = "inline-flex min-h-7 items-center rounded-2xl border px-2.5 py-1 text-[13px] leading-tight font-semibold no-underline hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";

/** COMPASS top-tier and the professional registers this master's counts toward, each linked to its official source. */
export function RecognitionBadges({ r, className }: { r: Pick2; className?: string }) {
  const t = useT();
  const { data } = useModel();
  const compass = compassFor(r);
  const badges = r.p.badges ?? [];
  if (!compass && !badges.length) return null;
  const src = data.standing;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {compass && src.compass && (
        <a
          href={src.compass.url}
          target="_blank"
          rel="noreferrer"
          className={cn(BADGE, "border-(--fd-met)/50 text-(--fd-met)")}
          title={compass.faculty ? t("MOM COMPASS top-tier institution: {faculty}", { faculty: compass.faculty }) : t("MOM COMPASS top-tier institution: every faculty")}
        >
          {t("COMPASS top-tier")}
        </a>
      )}
      {badges.map((b) => (
        <a key={b.kind + b.body} href={b.url} target="_blank" rel="noreferrer" className={cn(BADGE, "border-border text-foreground")} title={b.note}>
          {t(b.kind === "psychology" ? "SG psychologist route · {body}" : b.kind === "accounting" ? "SG CA route · {body}" : "SG bar route · {body}", { body: b.body })}
        </a>
      ))}
    </div>
  );
}
