"use client";

import { ArrowUpRightIcon, CheckIcon, CircleDashedIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEVEL_NAME } from "@/lib/admit-range";
import { msg } from "@/lib/i18n/translate";
import type { Prepared } from "@/lib/stand/score";
import { levelName, NOT_PROBABILITY } from "@/lib/stand/score";
import { say, type Gate, type GateKey, type PartKey, type StandScore } from "@/lib/stand/types";
import { FOCUS, n } from "./bands";

// One programme's index, opened in place: every gate with its reason, basis and the official words
// behind it (and, for a degree-type rule, the reading by the awarding country's row where it differs);
// the four parts as points × weight with each step; the facts about competition the admitted level
// already counts; and the official page.

export const GATE_NAME: Record<GateKey, string> = {
  "degree-type": msg("Degree type"),
  grade: msg("Grade"),
  english: msg("English"),
  tests: msg("GRE or GMAT"),
  work: msg("Work experience"),
  subject: msg("Subject"),
};
export const PART_NAME: Record<PartKey, string> = { academic: msg("Academic"), experience: msg("Experience"), tests: msg("Tests"), subject: msg("Subject") };
export const PARTS: PartKey[] = ["academic", "experience", "tests", "subject"];

/** The page's one footnote, beside the index's name: what the index is not. A tap or a rest opens it. */
function IndexNote() {
  const t = useT();
  return (
    <sup className="ml-0.5 align-super text-[length:min(0.62em,0.8125rem)] leading-none">
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={350}
          closeDelay={120}
          aria-label={t(NOT_PROBABILITY)}
          className={cn("inline-flex h-[1.6em] min-w-[1.6em] cursor-pointer items-center justify-center rounded-[0.35em] bg-current/10 px-[0.35em] font-semibold text-inherit hover:bg-current/20 data-popup-open:bg-current/20", FOCUS)}
        >
          *
        </PopoverTrigger>
        <PopoverContent className="text-xs text-pretty">{t(NOT_PROBABILITY)}</PopoverContent>
      </Popover>
    </sup>
  );
}

const GATE_STATE = {
  pass: { icon: CheckIcon, word: msg("Met"), className: "text-success" },
  fail: { icon: XIcon, word: msg("Not met"), className: "text-destructive" },
  missing: { icon: CircleDashedIcon, word: msg("Missing"), className: "text-muted-foreground" },
} as const;

const ADMITTED_FROM = {
  published: msg("the programme’s own words"),
  cases: msg("reported admitted students"),
  statistics: msg("official applications per place"),
  estimate: msg("its competitive wording and QS rank"),
  minimum: msg("its minimum"),
} as const;

export function OutLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-0.5 font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
      {children}
      <ArrowUpRightIcon aria-hidden className="size-3.5" />
    </a>
  );
}

function GateRow({ gate }: { gate: Gate }) {
  const t = useT();
  const s = GATE_STATE[gate.state];
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 py-2">
      <s.icon aria-hidden className={cn("mt-0.5 size-4", s.className)} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm">
          <span className="font-semibold">{t(GATE_NAME[gate.key])}</span>
          <span className="sr-only">, {t(s.word)}</span>
          {": "}
          {say(t, gate.reason)}
        </p>
        <p className="text-xs text-muted-foreground">{t("Basis: {basis}", { basis: say(t, gate.basis) })}</p>
        {gate.quote && (
          <blockquote lang="en" className="mt-1 border-l-2 border-(--land-line) pl-2.5 text-xs text-pretty text-(--land-body)">
            “{gate.quote.text}”{" "}
            <span className="whitespace-nowrap">
              <OutLink href={gate.quote.url}>{t("Official page")}</OutLink>
            </span>
          </blockquote>
        )}
        {gate.note && (
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-(--land-body)">
            <p className="font-medium">{say(t, gate.note.text)}</p>
            {gate.note.quote && (
              <blockquote lang="en" className="border-l-2 border-(--land-line) pl-2.5 text-pretty">
                “{gate.note.quote.text}”{" "}
                <span className="whitespace-nowrap">
                  <OutLink href={gate.note.quote.url}>{t("Official page")}</OutLink>
                </span>
              </blockquote>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function Breakdown({ x, s }: { x: Prepared; s: StandScore }) {
  const t = useT();
  const c = s.competition;
  return (
    <div className="flex flex-col gap-5 pt-1 pb-2">
      <section>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("Entry requirements")}</h4>
        <ul className="divide-y divide-(--land-line)">
          {s.gates.map((g) => (
            <GateRow key={g.key} gate={g} />
          ))}
        </ul>
      </section>

      {s.parts && (
        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("The index, part by part")}</h4>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 text-left font-medium">
                  {t("Part")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("Score")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("Weight")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("Points")}
                </th>
              </tr>
            </thead>
            {PARTS.map((k) => {
              const p = s.parts![k];
              return (
                <tbody key={k} className="border-t border-(--land-line)">
                  <tr>
                    <th scope="row" className="pt-2 text-left font-semibold">
                      {t(PART_NAME[k])}
                    </th>
                    <td className="pt-2 text-right">{p.score}</td>
                    <td className="pt-2 text-right">× {p.weight}%</td>
                    <td className="pt-2 text-right font-semibold">{((p.score * p.weight) / 100).toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="pb-2 text-xs text-pretty text-muted-foreground">
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {p.detail.map((d, i) => (
                          <li key={i}>{say(t, d)}</li>
                        ))}
                        <li>{t("Basis: {basis}", { basis: say(t, p.basis) })}</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              );
            })}
            <tfoot className="border-t-2 border-foreground/70">
              <tr>
                <th scope="row" colSpan={3} className="pt-2 text-left font-semibold">
                  {t("Competitiveness Index")}
                  <IndexNote />
                </th>
                <td className="pt-2 text-right text-base font-bold">{s.index}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <section className="flex flex-col gap-1.5 text-sm">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("Competition")}</h4>
        <ul className="flex flex-col gap-1">
          <li>{t("Admitted level: {level} (basis: {basis})", { level: t(LEVEL_NAME[c.admitted]), basis: t(ADMITTED_FROM[c.admittedBasis]) })}</li>
          {c.indexLevel?.rule && (
            <li>
              {t("The index reads it as {level} (UK mark {mark}): the minimum + one class step, Kaplan 360++’s rule", { level: say(t, levelName(c.indexLevel.mark)), mark: c.indexLevel.mark })}
            </li>
          )}
          {c.perPlace && (
            <li>
              {c.perPlace.year
                ? t("{a} applications for {p} places ({year})", { a: n(c.perPlace.applications), p: n(c.perPlace.places), year: c.perPlace.year })
                : t("{a} applications for {p} places", { a: n(c.perPlace.applications), p: n(c.perPlace.places) })}{" "}
              <OutLink href={c.perPlace.url}>{t("Source")}</OutLink>
            </li>
          )}
          {c.wording && (
            <li>
              <blockquote lang="en" className="border-l-2 border-(--land-line) pl-2.5 text-xs text-(--land-body)">
                “{c.wording}”
              </blockquote>
            </li>
          )}
          <li>{c.qs !== null ? t("QS World University Rankings 2027: {rank}", { rank: x.u.qs ?? c.qs }) : t("Not in the QS World University Rankings 2027")}</li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <OutLink href={x.p.url}>{t("Official programme page")}</OutLink>
        <Link href={`/results/compare?ids=${encodeURIComponent(x.p.id)}`} className={cn("font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
          {t("Open in Programmes for you")}
        </Link>
      </div>
    </div>
  );
}
