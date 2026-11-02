"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { ASIA } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMediaQuery } from "@/lib/use-media-query";
import type { Counts } from "@/lib/stand/aggregate";
import { GATE_LINE, scorePrepared, type Prepared } from "@/lib/stand/score";
import { OUTCOMES, say, type Outcome, type StandScore } from "@/lib/stand/types";
import { BANDS, BandWord, FOCUS, n, OUTCOME_LABEL, OUTCOME_TEXT } from "./bands";
import { Breakdown, PART_NAME, PARTS } from "./breakdown";
import { useStand } from "./model";

// The overview: how many programmes fall in each band, then a grid of field × country with the four
// bands' counts in each cell. A cell (or a band's count) opens its programmes in a sheet; a programme
// opens its breakdown in place.

/** Countries shown as columns before the rest are put together under "Other countries". */
const COLUMNS = 6;
const OTHER = "*";
/** Programmes listed in a sheet before "Show more". */
const PAGE = 25;
const ORDER: Record<Outcome, number> = { safe: 0, match: 1, reach: 2, far: 3, missing: 4, "not-eligible": 5 };

type Pick = { field: string | null; country: string | null; band: Outcome | null };

const zero = (): Counts => Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Counts;
const add = (a: Counts, b: Counts) => OUTCOMES.forEach((o) => (a[o] += b[o]));
const scored = (c: Counts) => c.safe + c.match + c.reach + c.far;

/** The two parts that lose the most points, the gates that fail, or the answers missing. */
function reasons(t: ReturnType<typeof useT>, s: StandScore): string[] {
  if (s.state === "not-eligible") return s.gates.filter((g) => g.state === "fail").slice(0, 2).map((g) => t(GATE_LINE.fail, { reason: say(t, g.reason) }));
  if (s.state === "missing") return s.gates.filter((g) => g.state === "missing").slice(0, 2).map((g) => t(GATE_LINE.missing, { item: say(t, g.reason) }));
  const lost = PARTS.map((k) => ({ k, p: s.parts![k], lost: ((100 - s.parts![k].score) * s.parts![k].weight) / 100 }))
    .filter((x) => x.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 2);
  if (!lost.length) return [t("Full points on every part")];
  return [t("Most points lost: {parts}", { parts: lost.map((x) => t("{part} {score} × {weight}%", { part: t(PART_NAME[x.k]), score: x.p.score, weight: x.p.weight })).join(" · ") })];
}

function ProgrammeItem({ x, s }: { x: Prepared; s: StandScore }) {
  const t = useT();
  const local = useLocalName();
  const outcome: Outcome = s.band ?? (s.state as Outcome);
  const name = local(x.p.name, x.p.zh);
  return (
    <Collapsible render={<li className="border-b border-(--land-line) last:border-b-0" />}>
      <CollapsibleTrigger className={cn("group/row flex w-full items-start gap-3 py-3 text-left", FOCUS, "rounded-md")}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs text-muted-foreground">
            {local(x.u.name, x.u.zh).name} · {t(x.country)}
          </span>
          <span className="text-sm leading-snug font-semibold text-pretty">{name.name}</span>
          {name.en && (
            <span lang="en" className="text-xs text-muted-foreground">
              {name.en}
            </span>
          )}
          {reasons(t, s).map((r, i) => (
            <span key={i} className="text-xs text-pretty text-(--land-body)">
              {r}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">{t("Basis: {basis}", { basis: say(t, s.basis) })}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {s.index !== null && (
            <span className={cn("font-heading text-2xl leading-none font-bold tabular-nums", OUTCOME_TEXT[outcome])}>
              {s.index}
              <span className="sr-only"> / 100</span>
            </span>
          )}
          <BandWord outcome={outcome} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Breakdown x={x} s={s} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A sheet's programmes: those in the cell, scored for the saved answers, best first, filtered by band. */
function ProgrammeList({ pick }: { pick: Pick }) {
  const t = useT();
  const { scope, profile } = useStand();
  const [band, setBand] = useState<Outcome | null>(pick.band);
  const [shown, setShown] = useState(PAGE);
  const all = useMemo(() => {
    const own = new Set(pickColumns(scope));
    const inCell = (x: Prepared) => (pick.field === null || x.p.discipline === pick.field) && (pick.country === null || x.country === pick.country || (pick.country === OTHER && !own.has(x.country)));
    return scope
      .filter(inCell)
      .map((x) => ({ x, s: scorePrepared(profile, x) }))
      .sort((a, b) => ORDER[a.s.band ?? (a.s.state as Outcome)] - ORDER[b.s.band ?? (b.s.state as Outcome)] || (b.s.index ?? 0) - (a.s.index ?? 0) || (a.x.u.qsValue ?? 9999) - (b.x.u.qsValue ?? 9999));
  }, [scope, profile, pick]);
  const counts = zero();
  for (const r of all) counts[r.s.band ?? (r.s.state as Outcome)]++;
  const list = band ? all.filter((r) => (r.s.band ?? r.s.state) === band) : all;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-(--land-line) px-4 pb-3">
        <ToggleGroup
          aria-label={t("Show")}
          variant="outline"
          size="sm"
          spacing={1}
          className="w-full flex-wrap"
          value={[band ?? "all"]}
          onValueChange={(v) => {
            const next = v[0];
            if (next === undefined) return;
            setBand(next === "all" ? null : (next as Outcome));
            setShown(PAGE);
          }}
        >
          <ToggleGroupItem value="all" className="h-7 gap-1 px-2">
            {t("All")} <span className="tabular-nums opacity-80">{n(all.length)}</span>
          </ToggleGroupItem>
          {OUTCOMES.filter((o) => counts[o] > 0).map((o) => (
            <ToggleGroupItem key={o} value={o} className="h-7 gap-1 px-2">
              {t(OUTCOME_LABEL[o])} <span className="tabular-nums opacity-80">{n(counts[o])}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <ul>
          {list.slice(0, shown).map((r) => (
            <ProgrammeItem key={r.x.p.id} x={r.x} s={r.s} />
          ))}
        </ul>
        {list.length > shown && (
          <Button variant="outline" size="sm" className="my-4" onClick={() => setShown((v) => v + PAGE)}>
            {t("Show {n} more", { n: Math.min(PAGE, list.length - shown) })}
          </Button>
        )}
        {list.length === 0 && <p className="py-6 text-sm text-muted-foreground">{t("No programme here.")}</p>}
      </div>
    </div>
  );
}

/** The countries with their own column: Singapore, Hong Kong and Macau first, then by programmes in scope. */
function pickColumns(scope: Prepared[]): string[] {
  const m = new Map<string, number>();
  for (const x of scope) m.set(x.country, (m.get(x.country) ?? 0) + 1);
  const sorted = [...m].sort((a, b) => Number(ASIA.includes(b[0])) - Number(ASIA.includes(a[0])) || b[1] - a[1]).map(([c]) => c);
  return sorted.length <= COLUMNS + 1 ? sorted : sorted.slice(0, COLUMNS);
}

/** The four bands' counts in one cell, best first, each in its band's colour and place. */
function CellCounts({ c }: { c: Counts }) {
  return (
    <span aria-hidden className="grid grid-cols-4 gap-x-1.5 text-[13px] leading-5 font-semibold tabular-nums">
      {BANDS.map((b) => (
        <span key={b} className={cn("min-w-5 text-right", c[b] ? OUTCOME_TEXT[b] : "font-normal text-muted-foreground")}>
          {c[b]}
        </span>
      ))}
    </span>
  );
}

export function Overview() {
  const t = useT();
  const locale = useIntlLocale();
  const { dist, disciplines, profile, answers, scope } = useStand();
  const wide = useMediaQuery("(min-width: 768px)", false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const own = profile.discipline;
  const columns = useMemo(() => pickColumns(scope), [scope]);
  const other = useMemo(() => new Set(scope.map((x) => x.country)).size > columns.length, [scope, columns]);
  const grid = useMemo(() => {
    const rows = new Map<string, { total: Counts; cells: Map<string, Counts> }>();
    for (const c of dist.cells) {
      let r = rows.get(c.field);
      if (!r) rows.set(c.field, (r = { total: zero(), cells: new Map() }));
      add(r.total, c.counts);
      const col = columns.includes(c.country) ? c.country : OTHER;
      let cell = r.cells.get(col);
      if (!cell) r.cells.set(col, (cell = zero()));
      add(cell, c.counts);
    }
    const all = (c: Counts) => OUTCOMES.reduce((s, o) => s + c[o], 0);
    // The student's own field first, then the fields with most programmes in a band.
    return [...rows].sort((a, b) => Number(b[0] === own) - Number(a[0] === own) || scored(b[1].total) - scored(a[1].total) || all(b[1].total) - all(a[1].total));
  }, [dist, columns, own]);

  const show = (p: Pick, el: HTMLElement) => {
    opener.current = el;
    setPick(p);
    setOpen(true);
  };
  const field = (id: string) => t(disciplines[id] ?? id);
  const country = (c: string) => (c === OTHER ? t("Other countries") : t(c));
  const isOpen = (p: Pick) => open && !!pick && pick.field === p.field && pick.country === p.country && pick.band === p.band;
  const list = (items: string[]) => new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  const scopeLine = [
    answers.countries.length ? t("In {countries}", { countries: list(answers.countries.map((c) => t(c))) }) : t("In every country"),
    answers.budget !== null ? t("tuition up to S${amount} a year, or no fee on the page", { amount: n(answers.budget) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const title = !pick
    ? ""
    : pick.field === null && pick.country === null
      ? t("{band}: {n} programmes", { band: t(OUTCOME_LABEL[pick.band!]), n: n(dist.counts[pick.band!]) })
      : `${pick.field ? field(pick.field) : t("Every field")} · ${pick.country ? country(pick.country) : t("Every country")}`;

  return (
    <section aria-labelledby="overview" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 id="overview" className="font-heading text-2xl font-bold tracking-[-0.01em] text-pretty sm:text-3xl">
          {t("Where you stand across {n} programmes", { n: n(dist.total) })}
        </h2>
        <p className="text-sm text-(--land-body)">{scopeLine}</p>
      </div>

      {/* The page's one big figure: the programmes in each band. */}
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-(--land-line) bg-(--land-line) sm:grid-cols-3">
        {OUTCOMES.map((o) => {
          const p: Pick = { field: null, country: null, band: o };
          const count = dist.counts[o];
          return (
            <li key={o} className="bg-(--land-card)">
              <button
                type="button"
                disabled={!count}
                aria-haspopup="dialog"
                aria-expanded={isOpen(p)}
                onClick={(e) => show(p, e.currentTarget)}
                className={cn("flex h-full w-full flex-col items-start gap-1 px-4 py-3 text-left enabled:hover:bg-(--land-tint)", FOCUS, "-outline-offset-2")}
              >
                <span className={cn("font-heading text-[32px] leading-none font-bold tabular-nums", count ? OUTCOME_TEXT[o] : "text-muted-foreground")}>{n(count)}</span>
                <span className="text-sm font-medium">{t(OUTCOME_LABEL[o])}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-lg font-bold">{t("By field and country")}</h3>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{t("Each cell, in this order:")}</span>
          {BANDS.map((b, i) => (
            <span key={b} className={cn("font-semibold", OUTCOME_TEXT[b])}>
              {i + 1}. {t(OUTCOME_LABEL[b])}
            </span>
          ))}
          <span>{t("Tap a cell for its programmes.")}</span>
        </p>
        <div className={cn("mx-[calc(var(--gutter)*-1)] overflow-x-auto px-(--gutter) sm:mx-0 sm:px-0", FOCUS, "-outline-offset-2 rounded-md")} tabIndex={0} role="region" aria-label={t("By field and country")}>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-32 bg-(--land-ground) py-2 pr-3 text-left text-xs font-medium text-muted-foreground">
                  {t("Field")}
                </th>
                {[...columns, ...(other ? [OTHER] : [])].map((c) => (
                  <th key={c} scope="col" className="px-1 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">
                    {country(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map(([f, row]) => (
                <tr key={f}>
                  <th scope="row" className="sticky left-0 z-10 border-t border-(--land-line) bg-(--land-ground) py-1.5 pr-3 text-left align-middle text-[13px] leading-tight font-medium">
                    {field(f)}
                  </th>
                  {[...columns, ...(other ? [OTHER] : [])].map((c) => {
                    const cell = row.cells.get(c);
                    const p: Pick = { field: f, country: c, band: null };
                    const total = cell ? OUTCOMES.reduce((s, o) => s + cell[o], 0) : 0;
                    return (
                      <td key={c} className="border-t border-(--land-line) px-0.5 py-1">
                        {cell && total ? (
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-expanded={isOpen(p)}
                            aria-label={t("{field}, {country}: {safe} Safe, {match} Match, {reach} Reach, {far} Far, {missing} Missing, {none} Not eligible", {
                              field: field(f),
                              country: country(c),
                              safe: cell.safe,
                              match: cell.match,
                              reach: cell.reach,
                              far: cell.far,
                              missing: cell.missing,
                              none: cell["not-eligible"],
                            })}
                            onClick={(e) => show(p, e.currentTarget)}
                            className={cn("rounded-md px-1.5 py-1 hover:bg-(--land-tint)", FOCUS)}
                          >
                            <CellCounts c={cell} />
                          </button>
                        ) : (
                          <span className="block px-1.5 text-muted-foreground">
                            <span aria-hidden>–</span>
                            <span className="sr-only">{t("No programmes")}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          finalFocus={opener}
          className={cn("gap-0 p-0", wide ? "data-[side=right]:w-[min(560px,92vw)] data-[side=right]:sm:max-w-none" : "max-h-[88dvh] rounded-t-xl")}
        >
          <SheetHeader className="pr-12">
            <SheetTitle className="text-lg font-bold">{title}</SheetTitle>
          </SheetHeader>
          {pick && <ProgrammeList key={JSON.stringify(pick)} pick={pick} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}
