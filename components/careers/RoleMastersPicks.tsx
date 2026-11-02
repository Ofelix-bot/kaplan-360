"use client";

import { useMemo } from "react";
import { ExternalLinkIcon, StarIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { ArrowSquare } from "@/components/shared/ArrowSquare";
import { Fn } from "@/components/shared/receipt/Fn";
import { ReceiptSection } from "@/components/shared/receipt/ReceiptSection";
import { SourceList } from "@/components/shared/receipt/SourceList";
import { DRAFT } from "@/content/draft";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import { coverableSet, keySkillCells } from "@/lib/careers/cells";
import { matchFor } from "@/lib/careers/match";
import { haveSet, masterCells, pickMasters, type MasterPick } from "@/lib/careers/masters";
import type { MasterOption, MatchBand, MatchRoleInput, StudentContext } from "@/lib/careers/types";
import { useMatchStudent } from "@/lib/careers/use-student";
import { hostOf, type ReceiptView } from "@/lib/receipts/model";
import { SkillCellLegend, SkillCells } from "./SkillCells";

// The student-dependent part of the role page's master's (plan F, Q36–Q38): the role's key-skill bar with the
// share no Kaplan degree covers, then the three master's lib/careers/masters picks for this student, each with
// its own bar (have / master's adds / an edge skill added / still missing), "+n → band (k of m)", the core and
// elective split, and one footnote to the programme's own page. Slot 1, when it adds edge skills, is outlined in
// amber and tagged. "Compare in Programme finder" opens the three side by side on /results/compare; "Add to your plan"
// goes to /plan when certificates and an internship close the student's gap without a master's.

const C = DRAFT.careers.masters;
const BAND: Record<MatchBand, string> = { high: C.high, medium: C.medium, low: C.low };
/** The section's closing links: "Compare in Programme finder" and, when no master's is needed, "Add to your plan". */
const ACTION =
  "group inline-flex items-center gap-3 rounded-lg text-[15px] font-semibold text-(--text) no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring)";
/** Longest elective name shown in the row; the full name is its title. */
const MODULE_MAX = 28;

const pageId = (id: string) => `master-page:${id}`;

/** The programme's own page, as the row's only receipt. Its modules were read from the page's text; no quote is kept. */
function pageView(o: MasterOption, title: string, where: string): ReceiptView {
  return {
    id: pageId(o.id),
    kind: "official",
    quote: null,
    mark: [],
    quoteKind: "sentence",
    publisher: o.university,
    title,
    published: null,
    read: "",
    url: o.url,
    host: hostOf(o.url),
    where,
    shot: null,
    match: "page-image",
  };
}

/** A module name cut at a word to MODULE_MAX characters. */
function shorten(name: string): string {
  if (name.length <= MODULE_MAX) return name;
  const cut = name.slice(0, MODULE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > MODULE_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,:;–-]+$/, "")}…`;
}

function Row({ pick, keys, have }: { pick: MasterPick; keys: string[]; have: Set<string> }) {
  const t = useT();
  const o = pick.option;
  const cells = useMemo(() => masterCells(pick, keys, have).map((state, i) => ({ skill: keys[i], state })), [pick, keys, have]);
  const added = pick.coreAdds.length + pick.electiveAdds.length;
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border bg-(--land-card) p-4 sm:p-5",
        pick.edge ? "border-(--accent-ink) shadow-[0_0_0_1px_var(--accent)]" : "border-(--land-line)",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 className="m-0 min-w-0 flex-1 basis-56 text-[16px] leading-snug font-semibold text-balance wrap-break-word text-(--text)">
          <a
            href={o.url}
            target="_blank"
            rel="noopener noreferrer"
            lang="en"
            className="rounded text-inherit underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
          >
            {o.name}
            <span className="font-normal text-(--land-body)"> · {o.university}</span>
            <ExternalLinkIcon aria-hidden className="ml-1.5 inline size-3.5 align-[-1px] text-(--land-body)" />
          </a>
        </h3>
        {pick.edge && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--accent) px-2.5 py-1 text-[12px] leading-none font-semibold text-(--accent-text)">
            <StarIcon aria-hidden className="size-3 fill-current" />
            {t(C.edge, { n: pick.edgeAdds.length })}
          </span>
        )}
      </div>
      <SkillCells cells={cells} label={t(C.bar, { programme: o.name, k: pick.nAfter, m: pick.m })} legend={false} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-[15px] leading-snug font-semibold text-(--text) tabular-nums">
          {t(C.result, { n: added, band: t(BAND[pick.bandAfter]), k: pick.nAfter, m: pick.m })}
          <Fn id={pageId(o.id)} />
        </p>
        {pick.electiveAdds.length > 0 && (
          <p className="m-0 text-[13px] leading-snug text-(--land-body)">
            {pick.coreAdds.length > 0 && <>{t(C.core, { n: pick.coreAdds.length })} · </>}
            {t.rich(
              C.pick,
              {},
              {
                n: pick.electiveAdds.length,
                modules: (
                  <>
                    {pick.electives.map((m, i) => (
                      <span key={m}>
                        {i > 0 && ", "}
                        <span lang="en" title={m.length > MODULE_MAX ? m : undefined} className="font-medium text-(--text)">
                          {shorten(m)}
                        </span>
                      </span>
                    ))}
                  </>
                ),
              },
            )}
          </p>
        )}
      </div>
    </li>
  );
}

export function RoleMastersPicks({ role, ctx, options }: { role: MatchRoleInput; ctx: StudentContext; options: MasterOption[] }) {
  const t = useT();
  const { student, example } = useMatchStudent(ctx);
  const result = useMemo(() => matchFor(student, role, ctx), [student, role, ctx]);
  // No master's needed: every missing key skill is covered by a certificate or named on the internship step
  // (the gap actions GapActions shows; electives aside). True too when nothing is missing. No degree, no match.
  const noMaster = useMemo(() => {
    if (!result) return false;
    const named = new Set(result.actions.internship.flatMap((a) => a.skills));
    return result.missing.every((g) => named.has(g.skill) || g.actions.some((a) => a.kind === "certificate"));
  }, [result]);
  const keys = useMemo(() => role.keySkills.filter((s) => s.key).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.skill), [role.keySkills]);
  const have = useMemo(() => haveSet(result), [result]);
  const picks = useMemo(() => pickMasters({ keySkills: keys, result, coverable: ctx.coverableSkills, options }), [keys, result, ctx.coverableSkills, options]);
  const top = useMemo(() => keySkillCells(role.keySkills, null, coverableSet(ctx.coverableSkills)), [role.keySkills, ctx.coverableSkills]);
  const receipts = useMemo(() => picks.map((p) => pageView(p.option, t(C.page, { programme: p.option.name }), t(C.pageWhere))), [picks, t]);

  const edge = top.filter((c) => c.state === "none").length;
  const headline =
    edge === 0 ? t(C.edgeNone) : edge === top.length ? t(C.edgeAll) : edge === 1 ? t(C.edgeShareOne, { m: top.length }) : t(C.edgeShare, { n: edge, m: top.length });
  const compare = `/results/compare?ids=${picks.map((p) => encodeURIComponent(p.option.id)).join(",")}`;
  // With the example open the links keep it (?example=, opened on click), as the entry's cards do.
  const keep = (path: string) => (example ? exampleHref(path, example) : path);
  const open = example ? () => openExampleNow(example) : undefined;

  return (
    <ReceiptSection receipts={receipts}>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="m-0 text-[17px] leading-snug font-semibold text-pretty text-(--text)">{headline}</p>
          <SkillCells cells={top} label={headline} />
        </div>
        {picks.length > 0 && (
          <>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {picks.map((p) => (
                <Row key={p.option.id} pick={p} keys={keys} have={have} />
              ))}
            </ol>
            <SkillCellLegend states={picks.some((p) => p.edgeAdds.length > 0) ? ["have", "master", "edge", "missing"] : ["have", "master", "missing"]} />
          </>
        )}
        {(picks.length > 0 || noMaster) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-3">
            {picks.length > 0 && (
              <Link href={keep(compare)} onClick={open} className={ACTION}>
                {t(C.compare)}
                <ArrowSquare />
              </Link>
            )}
            {noMaster && (
              <Link href={keep("/plan")} onClick={open} className={ACTION}>
                {t(C.toPlan)}
                <ArrowSquare />
              </Link>
            )}
          </div>
        )}
      </div>
      <SourceList className="mt-6" />
    </ReceiptSection>
  );
}
