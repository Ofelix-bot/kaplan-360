"use client";

import { createContext, use, type ReactNode } from "react";
import { SchoolIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/card";
import { CENTRE_ID, roadId, type Leaf, type Road, type Tree } from "@/lib/next-steps";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { FADE, MeasureMark } from "./ring";
import { basisOf, KIND_LABEL, LEAF_ICON, ROAD_ICON, roadVars, TILE, useMeasureWords, useSay } from "./roads";

// The map's three kinds of node, shared by the radial map (React Flow renders them) and the phone tree:
// the centre (the student's degree), a road, a leaf with its measure. Each sits in Appear, which plays
// the load motion once per visit (layer 0, then 1 at 0.12 s, then 2 at 0.24 s: opacity, scale 0.92 → 1
// and 12 px outward along its edge); while another leaf's panel is open, its surface and marks fade to
// 40% and its text stays as it is.

/** Seconds between the layers' entrances. */
export const LAYER_DELAY = 0.12;
/** How far a node travels outward as it enters, px. */
export const ENTER_SHIFT = 12;
/** Opacity of what is not on the selected chain while a panel is open. */
export const DIM = 0.4;

export type MapState = {
  tree: Tree;
  /** The selected leaf (the timeline shows it; the default is a preview, panel closed). */
  selected: Leaf;
  open: boolean;
  /** Pick a leaf, or a road (its first leaf), and open its panel. */
  choose: (id: string) => void;
  focused: string | null;
  setFocused: (id: string | null) => void;
  reduce: boolean;
  /** True once the load motion has run: later mounts start in place. */
  played: boolean;
  /** The centre was already on screen while the scores loaded, so it doesn't enter again. */
  centreShown: boolean;
};

const Ctx = createContext<MapState | null>(null);
export const MapProvider = Ctx;
export function useMap(): MapState {
  const m = use(Ctx);
  if (!m) throw new Error("useMap needs a MapProvider");
  return m;
}

/** The ids on the chain centre → road → selected leaf (nodes and edges). */
export function chainOf(leaf: Leaf): Set<string> {
  const road = roadId(leaf.road);
  return new Set([CENTRE_ID, road, leaf.id, `${CENTRE_ID}>${road}`, `${road}>${leaf.id}`]);
}

/** Whether a node or edge is faded: a panel is open and it is off the selected chain. */
export function useDimmed(id: string) {
  const m = useMap();
  return m.open && !chainOf(m.selected).has(id) && m.focused !== id;
}

/** The load motion's transition for a layer: delayed on the first run, at once later, none with reduced motion. */
export function enterTransition(layer: number, played: boolean, reduce: boolean) {
  if (reduce) return { duration: 0 };
  return { duration: DURATION.base, ease: EASE_OUT, delay: played ? 0 : layer * LAYER_DELAY };
}

/**
 * A node's motion: its entrance (from `shift` px back along its edge) and its dimming. Keyed on
 * reduced motion, so a visitor who turns it on mid-entrance gets the end state at once.
 */
export function Appear({ id, layer, shift, className, children }: { id: string; layer: 0 | 1 | 2; shift: { x: number; y: number }; className?: string; children: ReactNode }) {
  const m = useMap();
  const dim = useDimmed(id);
  const skip = m.reduce || m.played || (layer === 0 && m.centreShown);
  return (
    <motion.div
      key={m.reduce ? "still" : "moving"}
      className={cn("h-full w-full", className)}
      initial={skip ? false : { opacity: 0, scale: 0.92, x: -shift.x, y: -shift.y }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={enterTransition(layer, m.played, m.reduce)}
    >
      {/* Dimming fades the card's surface and its marks (CARD, FADE), never its text: that keeps 4.5:1. */}
      <div data-dim={dim ? "" : undefined} className="group/node h-full w-full">
        {children}
      </div>
    </motion.div>
  );
}

/**
 * The card every node is drawn on: shadcn's Card, scaled 1.02 on hover where hover exists (not with
 * reduced motion); dimmed, its surface and outline fade to 40% (DIM) over the ground.
 */
export const CARD =
  "h-full gap-0! py-0! rounded-2xl bg-(--land-card) group-data-dim/node:bg-[color-mix(in_oklab,var(--land-card)_40%,transparent)] group-data-dim/node:ring-foreground/4 motion-safe:transition-[scale,background-color,box-shadow] motion-safe:duration-[140ms] motion-safe:ease-out motion-safe:hover:scale-[1.02] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";
export const BUTTON = "flex h-full w-full items-center text-left outline-none";

/** `local`: the degree's Chinese name on the Chinese pages (lib/site-names.ts), shown first with the English `name` below it on one line. */
export type CentreView = { title: string; name: string | null; local?: string | null; sub: string | null; empty?: boolean };

/** A name longer than this is shortened in the centre (the house rule for labels). */
const LABEL_MAX = 30;
/** Degree titles' usual short forms, longest first so "Business Studies" wins over "Business". */
const DEGREE_SHORT: [string, string][] = [
  ["Bachelor of Business Studies", "BBS"],
  ["Bachelor of Business", "BBus"],
  ["Bachelor of Information Technology", "BIT"],
  ["Bachelor of Communication", "BComm"],
  ["Bachelor of Data Analytics", "BDA"],
  ["Bachelor of Computer Science", "BCompSc"],
  ["Bachelor of Psychology", "BPsych"],
  ["Bachelor of Criminology", "BCrim"],
  ["Bachelor of Engineering", "BEng"],
  ["Bachelor of Education", "BEd"],
  ["Bachelor of Commerce", "BCom"],
  ["Bachelor of Science", "BSc"],
  ["Bachelor of Nursing", "BN"],
  ["Bachelor of Arts", "BA"],
  ["Bachelor of Laws", "LLB"],
  ["Master of Business Administration", "MBA"],
  ["Master of Science", "MSc"],
  ["Master of Arts", "MA"],
];

/**
 * A degree's name in the centre: as it is when it fits LABEL_MAX, else in its short form
 * ("Bachelor of Business Studies (Honours) (Business Analytics) (Top-up)" → "BBS (Hons) Business
 * Analytics"). Names in other scripts pass through unchanged.
 */
export function shortDegree(name: string): string {
  if (name.length <= LABEL_MAX) return name;
  let s = name.replace(/\s*\(Top-up\)/gi, "").replace(/\(Honours\)|\bHonours\b/g, "(Hons)");
  const head = DEGREE_SHORT.find(([full]) => s.startsWith(full));
  if (head) s = head[1] + s.slice(head[0].length).replace(/^ in /, " ");
  // The field in brackets after (Hons) reads as plain words: "(Hons) (Finance)" → "(Hons) Finance".
  s = s.replace(/\(Hons\) \(([^()]+)\)/, "(Hons) $1").replace(/ and /g, " & ");
  return s.replace(/\s+/g, " ").trim();
}

/** The centre: the degree the roads are computed on (a long name in its short form, the full name read out and on hover). */
export function CentreCard({ view }: { view: CentreView }) {
  const t = useT();
  const short = view.name ? shortDegree(view.name) : null;
  return (
    <Card style={roadVars("study")} className={cn(CARD, "motion-safe:hover:scale-100 shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--r)_45%,transparent)]")}>
      <div className="flex h-full items-center gap-3 px-3">
        <span aria-hidden className={cn(TILE, "size-12 rounded-xl")}>
          <SchoolIcon className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-heading text-[15px] leading-tight font-bold">{view.title}</p>
          {view.name && view.local && (
            <>
              <p title={view.local} className="line-clamp-2 text-xs leading-snug font-medium">
                {view.local}
              </p>
              <p lang="en" title={view.name} className="truncate text-xs leading-snug text-(--land-body)">
                <span aria-hidden>{short}</span>
                <span className="sr-only">{view.name}</span>
              </p>
            </>
          )}
          {view.name &&
            !view.local &&
            (short === view.name ? (
              <p className="line-clamp-2 text-xs leading-snug text-(--land-body)">{view.name}</p>
            ) : (
              <p title={view.name} className="line-clamp-2 text-xs leading-snug text-(--land-body)">
                <span aria-hidden>{short}</span>
                <span className="sr-only">{view.name}</span>
              </p>
            ))}
          {view.sub && <p className="truncate text-xs leading-snug text-muted-foreground">{view.sub}</p>}
          {view.empty && <p className="text-xs text-muted-foreground">{t("Tell us your degree first")}</p>}
        </div>
      </div>
    </Card>
  );
}

/** A road: its tile, its name and how many leaves it has. `static`: names only (no answers yet). */
export function RoadCard({ road, still }: { road: Pick<Road, "key" | "name"> & { leaves?: Leaf[] }; still?: boolean }) {
  const t = useT();
  const say = useSay();
  const Icon = ROAD_ICON[road.key];
  const body = (
    <>
      <span aria-hidden className={cn(TILE, FADE, "size-10 rounded-xl")}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-2 text-sm leading-tight font-bold">{say(road.name)}</span>
        {road.leaves && <span className="text-xs text-muted-foreground">{t("{n} roads", { n: road.leaves.length })}</span>}
      </span>
    </>
  );
  if (still)
    return (
      <Card style={roadVars(road.key)} className={cn(CARD, "motion-safe:hover:scale-100")}>
        <div className={cn(BUTTON, "gap-2.5 px-3")}>{body}</div>
      </Card>
    );
  return <RoadButton road={road as Road}>{body}</RoadButton>;
}

function RoadButton({ road, children }: { road: Road; children: ReactNode }) {
  const t = useT();
  const say = useSay();
  const m = useMap();
  const id = roadId(road.key);
  const on = m.selected.road === road.key;
  return (
    <Card style={roadVars(road.key)} className={cn(CARD, on && "shadow-[inset_0_0_0_2px_var(--r)]")}>
      <button
        type="button"
        className={cn(BUTTON, "gap-2.5 px-3")}
        aria-label={t("{road}: {n} roads. Opens {leaf}", { road: say(road.name), n: road.leaves.length, leaf: say(road.leaves[0].name) })}
        data-node={id}
        onClick={() => m.choose(id)}
        onFocus={() => m.setFocused(id)}
        onBlur={() => m.setFocused(null)}
      >
        {children}
      </button>
    </Card>
  );
}

/** A leaf: its measure, name and one line; selected, it carries an inset ring in the road's colour. */
export function LeafCard({ leaf, compact }: { leaf: Leaf; compact?: boolean }) {
  const t = useT();
  const say = useSay();
  const words = useMeasureWords();
  const m = useMap();
  const Icon = LEAF_ICON[leaf.key];
  const on = m.selected.id === leaf.id;
  const basis = basisOf(leaf.measure);
  const kind = basis ? t(KIND_LABEL[basis.kind]) : null;
  return (
    <Card style={roadVars(leaf.road)} className={cn(CARD, on && "shadow-[inset_0_0_0_2px_var(--r)]")}>
      <button
        type="button"
        className={cn(BUTTON, compact ? "gap-3 px-3" : "gap-2.5 px-2.5")}
        aria-label={
          kind
            ? t("{leaf}, {line}: {measure}. Basis: {basis}", { leaf: say(leaf.name), line: say(leaf.line), measure: words(leaf.measure), basis: kind })
            : t("{leaf}, {line}: {measure}", { leaf: say(leaf.name), line: say(leaf.line), measure: words(leaf.measure) })
        }
        aria-pressed={m.open && on}
        data-node={leaf.id}
        onClick={() => m.choose(leaf.id)}
        onFocus={() => m.setFocused(leaf.id)}
        onBlur={() => m.setFocused(null)}
      >
        <MeasureMark m={leaf.measure} size={48} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-start gap-1">
            <Icon aria-hidden className={cn(FADE, "mt-px size-3.5 shrink-0 text-(--r)")} />
            {/* Three lines, so an official name as long as "Chartered Accountants Ireland" reads in full on the map. */}
            <span className="line-clamp-3 text-[13px] leading-tight font-semibold">{say(leaf.name)}</span>
          </span>
          <span className="line-clamp-2 text-xs leading-snug text-(--land-body)">{say(leaf.line)}</span>
          {leaf.measure.kind === "missing" && <span className="truncate text-[11px] leading-snug font-medium text-muted-foreground">{say(leaf.measure.text)}</span>}
        </span>
      </button>
    </Card>
  );
}
