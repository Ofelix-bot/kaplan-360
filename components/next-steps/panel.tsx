"use client";

import type { ReactNode } from "react";
import { ArrowRightIcon, ArrowUpRightIcon, BadgeCheckIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon, InfoIcon, LaptopIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { BandWord, n, OUTCOME_LABEL } from "@/components/stand/bands";
import { GATE_NAME } from "@/components/stand/breakdown";
import { useLocalName } from "@/components/results/names";
import { Button } from "@/components/ui/button";
import { msg } from "@/lib/i18n/translate";
import {
  type Basis,
  type CareersPanel,
  type EpPanel,
  type HomePanel,
  type Leaf,
  type Link as PageLink,
  type OtherPanel,
  type PayBar,
  type QualifyPanel,
  type StudyPanel,
} from "@/lib/next-steps";
import type { Outcome } from "@/lib/stand/types";

import { MeasureMark } from "./ring";
import { BasisChip, OutLink, ROAD_ICON, roadVars, TILE, useMeasureWords, useSay } from "./roads";

// A leaf's detail, in the side panel (1200 px and wider) or a sheet: a band in the road's gradient with
// its icon and the leaf's name, the measure large with its unit and basis, then what the leaf is made
// of as pictures: the stacked outcome bar and what holds the rest back (study), pay as bars (work),
// the body's facts (qualifications), today against after the change (other roads). Links as buttons.

/** Each outcome's fill on the stacked bar; the legend names every one beside its count. */
const OUTCOME_FILL: Record<Outcome, string> = {
  safe: "bg-success",
  match: "bg-(--brand-ink)",
  reach: "bg-(--accent)",
  far: "bg-destructive",
  missing: "bg-[repeating-linear-gradient(135deg,var(--muted)_0_2px,transparent_2px_5px)] ring-1 ring-inset ring-(--muted)",
  "not-eligible": "bg-(--land-line)",
};

const PAY_KAPLAN = "Kaplan graduates’ median";
// lib/next-steps/tree.ts's label for the EP bar (M4: only what MOM's sentence says, no year or age).
const PAY_EP = "EP minimum qualifying salary";
/** The lever each other road tries, as the second bar's label. */
const AFTER_WORK = msg("With one more year of work");
const AFTER_INTERNSHIP = msg("With one more internship");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** The road's gradient band: its icon, the leaf's name and road, and the close button. */
export function PanelBand({ leaf, roadName, onClose, title }: { leaf: Leaf; roadName: string; onClose: () => void; title?: (children: ReactNode) => ReactNode }) {
  const t = useT();
  const say = useSay();
  const Icon = ROAD_ICON[leaf.road];
  const name = <span className="font-heading text-lg leading-tight font-bold">{say(leaf.name)}</span>;
  return (
    <div style={roadVars(leaf.road)} className={cn(TILE, "relative flex-col items-start justify-start gap-2 rounded-t-2xl px-5 pt-4 pb-5")}>
      <Icon aria-hidden className="size-8" />
      <div className="flex flex-col pr-10">
        {title ? title(name) : (
          <h2 tabIndex={-1} className="outline-none">
            {name}
          </h2>
        )}
        <span className="text-sm font-medium opacity-90">{roadName}</span>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("Close")} className="absolute top-3 right-3 text-(--r-on) hover:bg-black/10 hover:text-(--r-on)">
        <XIcon />
      </Button>
    </div>
  );
}

/** The measure large, with its unit, what it counts, and its chip. */
function Headline({ leaf, lines, aside, more = [] }: { leaf: Leaf; lines: string[]; aside?: string | null; more?: Basis[] }) {
  const t = useT();
  const say = useSay();
  const words = useMeasureWords();
  const m = leaf.measure;
  return (
    <div className="flex items-center gap-4">
      <MeasureMark m={m} size={96} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-heading text-base leading-tight font-bold">{m.kind === "ring" ? say(m.label) : words(m)}</p>
        {(m.kind === "missing" && m.href ? [say(m.what)] : lines).map((l) => (
          <p key={l} className="text-xs leading-snug text-(--land-body)">
            {l}
          </p>
        ))}
        {m.kind !== "missing" && <BasisChip bases={[m.basis, ...more, m.rule]} aside={aside} className="mt-0.5 self-start" />}
        {m.kind === "missing" && m.basis && <BasisChip bases={[m.basis]} className="mt-0.5 self-start" />}
        {m.kind === "missing" && m.href && (
          <Button size="sm" className="mt-1 self-start" render={<Link href={m.href} />} nativeButton={false}>
            {t("Add your answer")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Links({ links }: { links: PageLink[] }) {
  const say = useSay();
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l, i) => (
        <Button key={l.href} variant={i === 0 ? "default" : "outline"} render={<Link href={l.href} title={say(l.what)} />} nativeButton={false}>
          {say(l.label)}
          <span className="sr-only">: {say(l.what)}</span>
        </Button>
      ))}
    </div>
  );
}

function OutButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="outline" render={<a href={href} target="_blank" rel="noreferrer" />} nativeButton={false}>
      {children}
      <ArrowUpRightIcon aria-hidden data-icon="inline-end" />
    </Button>
  );
}

// ---------- Further study ----------

function StudyBody({ leaf, p }: { leaf: Leaf; p: StudyPanel }) {
  const t = useT();
  const local = useLocalName();
  const programme = p.reference ? local(p.reference.name, p.reference.zh) : null;
  const university = p.reference ? local(p.reference.university, p.reference.universityZh) : null;
  const k = p.counts.filter((c) => c.outcome === "safe" || c.outcome === "match").reduce((s, c) => s + c.n, 0);
  return (
    <>
      <Headline leaf={leaf} lines={p.total ? [t("{k} of {n} programmes", { k: n(k), n: n(p.total) })] : []} />
      {p.total > 0 && (
        <Section title={t("By band")}>
          <div role="img" aria-label={p.counts.map((c) => `${t(OUTCOME_LABEL[c.outcome])} ${c.n}`).join(", ")} className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
            {p.counts
              .filter((c) => c.n > 0)
              .map((c) => (
                <span key={c.outcome} className={cn("h-full first:rounded-l-full last:rounded-r-full", OUTCOME_FILL[c.outcome])} style={{ flexGrow: c.n, flexBasis: 0, minWidth: 3 }} />
              ))}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {p.counts.map((c) => (
              <li key={c.outcome} className="inline-flex items-center gap-1.5 tabular-nums">
                <span aria-hidden className={cn("size-2.5 rounded-full", OUTCOME_FILL[c.outcome])} />
                <span>{t(OUTCOME_LABEL[c.outcome])}</span>
                <span className="font-semibold">{n(c.n)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {p.held.length > 0 && (
        <Section title={t("What holds the rest back")}>
          <ul className="flex flex-col divide-y divide-(--land-line) rounded-xl border border-(--land-line)">
            {p.held.slice(0, 5).map((h) => {
              const Icon = h.state === "fail" ? CircleXIcon : CircleDashedIcon;
              return (
                <li key={`${h.gate}|${h.state}`} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                  <Icon aria-hidden className={cn("size-4 shrink-0", h.state === "fail" ? "text-destructive" : "text-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">
                    {t(GATE_NAME[h.gate])} · <span className="text-(--land-body)">{h.state === "fail" ? t("Not met") : t("Missing")}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{n(h.n)}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {p.reference && (
        <Section title={t("Timeline dated from")}>
          <div className="flex flex-col gap-1.5 rounded-xl border border-(--land-line) p-3">
            <p className="line-clamp-2 text-sm leading-snug font-semibold">{programme!.name}</p>
            {programme!.en && (
              <p lang="en" className="line-clamp-2 text-xs leading-snug text-(--land-body)">
                {programme!.en}
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground">{university!.name}</p>
            {university!.en && (
              <p lang="en" className="truncate text-xs text-muted-foreground">
                {university!.en}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <BandWord outcome={p.reference.outcome} />
              <BasisChip bases={[p.reference.basis]} />
            </div>
          </div>
        </Section>
      )}
      <Links links={p.links} />
    </>
  );
}

// ---------- Straight to work ----------

/** Monthly pay as bars against the largest, each with its own chip. */
function PayBars({ bars }: { bars: PayBar[] }) {
  const t = useT();
  const say = useSay();
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <Section title={t("Monthly pay, S$")}>
      <ul className="flex flex-col gap-3">
        {bars.map((b) => {
          const key = b.label.key;
          const label = key === PAY_EP ? t(PAY_EP) : key === PAY_KAPLAN ? t(PAY_KAPLAN) : say(b.label);
          const caption = key === PAY_EP ? t("MOM") : key === PAY_KAPLAN ? t("SWDA graduate survey") : t("MOM median, all ages");
          return (
            <li key={key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">{label}</span>
                <span className="font-heading text-sm font-bold tabular-nums">S${n(b.value)}</span>
              </div>
              <span aria-hidden className="h-2.5 rounded-r-full rounded-l-sm bg-(--r)" style={{ width: `${(100 * b.value) / max}%` }} />
              <div className="flex items-center gap-2">
                <span className="truncate text-xs text-muted-foreground">{caption}</span>
                <BasisChip bases={[b.basis]} />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function EpBody({ leaf, p }: { leaf: Leaf; p: EpPanel }) {
  const t = useT();
  const local = useLocalName();
  const awarder = p.awarder ? local(p.awarder.name, p.awarder.zh) : null;
  const route = p.route === "top100" ? t("QS top-100 awarder: 20 points") : p.route === "pei" ? t("PEI degree: 10 points") : t("Diploma alone: 0 points");
  return (
    <>
      <Headline leaf={leaf} more={p.quotes} lines={[
          route,
          ...(p.awarder && awarder ? [p.awarder.qs ? t("{university} · QS {rank}", { university: awarder.name, rank: p.awarder.qs }) : awarder.name] : []),
          ...(awarder?.en ? [awarder.en] : []),
        ]}
      />
      <Section title={t("COMPASS")}>
        <ul className="flex flex-col gap-2 text-sm">
          {p.pei && (
            <li className="flex items-center gap-2.5">
              <InfoIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">{t("MOM’s PEI page: 10 points")}</span>
              <BasisChip bases={[p.pei]} />
            </li>
          )}
          <li className="flex items-center gap-2.5">
            <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1">{t("40 points needed to pass")}</span>
            <BasisChip bases={[p.pass.basis]} />
          </li>
          {p.diploma && (
            <li className="flex items-center gap-2.5">
              <CircleXIcon aria-hidden className="size-4 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1">{t("Your diploma alone: 0 points")}</span>
              <BasisChip bases={[p.diploma]} />
            </li>
          )}
        </ul>
      </Section>
      <PayBars bars={p.pay} />
      {p.pass.basis.url && <OutButton href={p.pass.basis.url}>{t("MOM’s EP page")}</OutButton>}
    </>
  );
}

function CareersBody({ leaf, p }: { leaf: Leaf; p: CareersPanel }) {
  const t = useT();
  return (
    <>
      <Headline leaf={leaf} lines={[t("SWDA graduate survey"), ...(p.career ? [t(p.career.title)] : [])]} />
      <PayBars bars={p.pay} />
      <Links links={p.links} />
    </>
  );
}

function HomeBody({ leaf, p }: { leaf: Leaf; p: HomePanel }) {
  const t = useT();
  const say = useSay();
  return (
    <>
      <Headline leaf={leaf} lines={[say(leaf.line), ...(p.row ? [p.row] : [])]} />
      <Section title={t("Official pages")}>
        <ul className="flex flex-col gap-2">
          {p.notes.map((b, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              {b.url ? <OutLink href={b.url}>{i === 0 ? t("CSCSE’s notice") : t("Kaplan’s CSCSE page")}</OutLink> : <span>{say(b.text)}</span>}
              <BasisChip bases={[b]} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

// ---------- Qualifications ----------

function QualifyBody({ leaf, p }: { leaf: Leaf; p: QualifyPanel }) {
  const t = useT();
  const say = useSay();
  const exempt = new Set(p.exempt ?? []);
  const missing = leaf.measure.kind === "missing";
  return (
    <>
      <Headline leaf={leaf} aside={p.note} lines={missing ? [t("Not collected yet")] : [say(leaf.line), ...(p.bodyName ? [p.bodyName] : [])]} />
      {p.rule && p.category && (
        <div className="flex items-center gap-2 text-sm">
          <BadgeCheckIcon aria-hidden className="size-4 shrink-0 text-(--r)" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span>{t("ACCA category")}</span>
            <span lang="en" className="truncate text-xs text-(--land-body)">
              {p.category.name}
            </span>
          </span>
          <BasisChip bases={[p.rule]} />
        </div>
      )}
      {p.exams.length > 0 && (
        <Section title={t("ACCA’s {n} exams", { n: p.exams.length })}>
          <ul className="grid grid-cols-2 gap-1.5">
            {p.exams.map((e) => {
              const yes = exempt.has(e);
              const Icon = yes ? CircleCheckIcon : CircleDashedIcon;
              return (
                <li key={e} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-(--land-line) px-2 py-1.5 text-xs">
                  <Icon aria-hidden className={cn("size-3.5 shrink-0", yes ? "text-success" : "text-muted-foreground")} />
                  <span className="truncate" lang="en">
                    {e}
                  </span>
                  <span className="sr-only">{yes ? t("Exempt") : t("To sit")}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {(p.basis?.url || p.bodyBasis?.url) && (
        <div className="flex flex-wrap gap-2">
          {p.basis?.url && <OutButton href={p.basis.url}>{t("Official page")}</OutButton>}
          {p.bodyBasis?.url && <OutButton href={p.bodyBasis.url}>{t("Professional body’s page")}</OutButton>}
        </div>
      )}
    </>
  );
}

// ---------- Other roads ----------

function OtherBody({ leaf, p }: { leaf: Leaf; p: OtherPanel }) {
  const t = useT();
  const say = useSay();
  const pct = (k: number, of: number) => (of ? Math.round((100 * k) / of) : 0);
  const after = leaf.key === "internship-first" ? AFTER_INTERNSHIP : AFTER_WORK;
  const rows = [
    { label: t("Today"), ...p.now, on: false },
    { label: t(after), ...p.after, on: true },
  ];
  return (
    <>
      <Headline leaf={leaf} lines={[]} />
      {/* At Missing the headline names the count waiting on the answer; bars here would read a measured 0%. */}
      {leaf.measure.kind !== "missing" && (
        <Section title={t("Match or better")}>
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">{r.label}</span>
                  <span className="text-xs text-(--land-body) tabular-nums">
                    <span className="font-heading text-sm font-bold text-foreground">{pct(r.k, r.n)}%</span> · {t("{k} of {n}", { k: n(r.k), n: n(r.n) })}
                  </span>
                </div>
                <span aria-hidden className="h-2.5 w-full overflow-hidden rounded-full bg-(--land-line)">
                  <span className={cn("block h-full rounded-full", r.on ? "bg-(--r)" : "bg-(--muted)")} style={{ width: `${pct(r.k, r.n)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {p.moves.length > 0 && (
        <Section title={t("What moves")}>
          <ul className="flex flex-col gap-1.5">
            {p.moves.slice(0, 4).map((mv) => (
              <li key={`${mv.from}>${mv.to}`} className="flex items-center gap-2 text-sm tabular-nums">
                <BandWord outcome={mv.from} />
                <ArrowRightIcon aria-label={t("to")} className="size-3.5 shrink-0 text-muted-foreground" />
                <BandWord outcome={mv.to} />
                <span className="ml-auto font-semibold">{n(mv.n)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {p.closed.length > 0 && (
        <Section title={t("Now known: not eligible")}>
          <ul className="flex flex-col divide-y divide-(--land-line) rounded-xl border border-(--land-line)">
            {p.closed.slice(0, 4).map((c) => (
              <li key={c.gate} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <CircleXIcon aria-hidden className="size-4 shrink-0 text-destructive" />
                <span className="min-w-0 flex-1 truncate">
                  {t(GATE_NAME[c.gate])} · <span className="text-(--land-body)">{t("Not met")}</span>
                </span>
                <span className="font-semibold tabular-nums">{n(c.n)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {p.activities.length > 0 && (
        <Section title={t("Options that fit your pass")}>
          <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {p.activities.map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5 rounded-xl border border-(--land-line) p-2.5">
                <span aria-hidden className={cn(TILE, "size-8 rounded-lg")}>
                  <LaptopIcon className="size-4" />
                </span>
                <p lang="en" className="line-clamp-2 text-xs leading-snug font-semibold">
                  {a.title}
                </p>
                {a.short !== a.title && <p className="line-clamp-2 text-xs leading-snug text-(--land-body)">{t(a.short)}</p>}
                <OutLink href={a.url} className="text-xs">
                  {t("Official page")}
                </OutLink>
              </li>
            ))}
          </ul>
          {p.rule && (
            <div className="flex items-center gap-2 text-xs text-(--land-body)">
              <BadgeCheckIcon aria-hidden className="size-4 shrink-0 text-(--r)" />
              <span>{t("Student’s Pass work rule")}</span>
              <BasisChip bases={[p.rule]} />
            </div>
          )}
        </Section>
      )}
      <span className="sr-only">{say(p.change)}</span>
    </>
  );
}

/** The leaf's detail below its band. */
export function PanelBody({ leaf }: { leaf: Leaf }) {
  const p = leaf.panel;
  return (
    <div style={roadVars(leaf.road)} className="flex flex-col gap-6 px-5 pt-5 pb-6">
      {p.kind === "study" && <StudyBody leaf={leaf} p={p} />}
      {p.kind === "ep" && <EpBody leaf={leaf} p={p} />}
      {p.kind === "careers" && <CareersBody leaf={leaf} p={p} />}
      {p.kind === "home" && <HomeBody leaf={leaf} p={p} />}
      {p.kind === "qualify" && <QualifyBody leaf={leaf} p={p} />}
      {p.kind === "other" && <OtherBody leaf={leaf} p={p} />}
    </div>
  );
}

