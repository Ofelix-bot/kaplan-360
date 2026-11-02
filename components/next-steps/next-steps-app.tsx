"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import { SchoolIcon } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import Link from "@/components/i18n/Link";
import { useReduce } from "@/components/landing/use-clock";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { StandProvider, useStand, type StandProps } from "@/components/stand/model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { monthYear } from "@/lib/i18n/format";
import { applyExampleFromUrl, openExampleNow } from "@/lib/example-link";
import { buildNextSteps, leavesOf, type Leaf, type NextStepsFacts, type Tree } from "@/lib/next-steps";
import { DURATION, EASE_OUT, transitions } from "@/lib/motion";
import { personaById } from "@/lib/personas";
import { plannedDegree, type PlanAnswers } from "@/lib/plan-storage";
import { otherSchoolDegree } from "@/lib/stand/profile";
import { useMediaQuery } from "@/lib/use-media-query";
import { useResultsData } from "@/lib/workspace/data";
import { startPlanStore, usePlanStore } from "@/lib/workspace/plan-store";
import { ColumnTree, ColumnWaiting } from "./column";
import { GROUPS, groupTree } from "./groups";
import { RadialMap, RadialWaiting } from "./map";
import { MapProvider, RoadCard, type CentreView, type MapState } from "./nodes";
import { PanelBand, PanelBody } from "./panel";
import { shortUniversity, TILE, roadVars, useSay } from "./roads";
import { Sources, type SourceDates } from "./sources";
import { PathTimeline } from "./timeline";

// The map of roads from the student's degree, /plan's Map tab (components/plan/PlanTabs.tsx) and the
// /next-steps page: the degree in the centre with three groups out of it, Work, Study and Gap
// (./groups.ts forms them from the four roads lib/next-steps builds on Where you stand's model), the
// selected leaf on a timeline at now, +12 and +24 months, its detail in a panel beside the map (a sheet
// on smaller screens), and the sources. The answers, the examples and the data are Where you stand's own
// (components/stand/model.tsx); the index runs in the browser and the answers never leave it.

/** The leaf the timeline previews before any choice: highlighted, panel closed. */
const DEFAULT_LEAF = "study/same-field";
/** A leaf asked for by ?leaf=<id> (the /move door and road cards): `n` tells two asks for the same leaf apart. */
type LeafAsk = { id: string; n: number } | null;
type SetLeafAsk = Dispatch<SetStateAction<LeafAsk>>;
/** After this, the load motion has run: later mounts (a breakpoint change) start in place. */
const LOAD_DONE_MS = 600;
/**
 * The radial map's frame from 800 to 1199 px: it reaches past the page gutter (32 px from 720 px up),
 * so the 760 px map and its cards' hover growth fit from 800 px on, a desktop scrollbar included.
 */
const RADIAL_FIT = "-mx-(--gutter) flex justify-center overflow-x-clip";

/** The school, the awarding university and the field, from the answers alone (no data needed). */
function useDegreeHead(stand: StandProps, a: PlanAnswers) {
  return useMemo(() => {
    if (a.school && a.school !== "kaplan") {
      const d = otherSchoolDegree(a);
      const school = stand.schools.find((s) => s.id === a.school)?.name ?? a.school;
      return d ? { school, university: d.university, name: d.name, field: d.discipline ? (stand.disciplines[d.discipline] ?? null) : null } : null;
    }
    const k = stand.programmes.find((p) => p.id === plannedDegree(a) && p.level === "degree");
    return k ? { school: "Kaplan", university: k.university, name: k.name, field: k.discipline ? (stand.disciplines[k.discipline] ?? null) : null } : null;
  }, [stand, a]);
}

/** No degree to compute the roads on: the three groups by name around the way in (Gap under it, as on the map). */
function Empty() {
  const t = useT();
  const arjun = personaById("arjun");
  const [work, study, gap] = GROUPS;
  const card = (g: (typeof GROUPS)[number], className?: string) => (
    <div className={cn("h-16", className)}>
      <RoadCard still road={{ key: g.key, name: { key: g.name } }} />
    </div>
  );
  return (
    <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-3">
      {card(work)}
      {card(study)}
      <Card style={roadVars("study")} className="col-span-2 items-center gap-4 rounded-2xl bg-(--land-card) px-4 py-8 text-center">
        <span aria-hidden className={cn(TILE, "size-20 rounded-2xl")}>
          <SchoolIcon className="size-12" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-bold">{t("Your degree")}</p>
          <p className="text-sm text-(--land-body)">{t("Tell us your degree first")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button render={<Link href="/profile" />} nativeButton={false}>
            {t("Fill in your answers")}
          </Button>
          {arjun && (
            <Button variant="outline" onClick={() => openExampleNow(arjun.id)}>
              {t("Try {name}", { name: arjun.name })}
            </Button>
          )}
        </div>
      </Card>
      {card(gap, "col-span-2 mx-auto w-[calc(50%-6px)]")}
    </div>
  );
}

function Failed() {
  const t = useT();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-(--land-body)">
      <p>{t("The programme list didn’t load")}</p>
      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
        {t("Reload")}
      </Button>
    </div>
  );
}

/** The map, the panel and the timeline, once Where you stand's model is ready. */
function Ready({ facts, dates, centreShown, ask, setAsk }: { facts: NextStepsFacts; dates: SourceDates; centreShown: boolean; ask: LeafAsk; setAsk: SetLeafAsk }) {
  const t = useT();
  const say = useSay();
  const locale = useIntlLocale();
  const names = useSiteNames();
  const model = useStand();
  const reduce = useReduce();
  const wide = useMediaQuery("(min-width: 1200px)");
  const radial = useMediaQuery("(min-width: 800px)");
  // The engine's four roads as the map's three groups: everything below reads the grouped tree.
  const tree: Tree = useMemo(() => groupTree(buildNextSteps(model, facts, new Date())), [model, facts]);
  const [selectedId, setSelectedId] = useState(DEFAULT_LEAF);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPlayed(true), LOAD_DONE_MS);
    return () => clearTimeout(id);
  }, []);
  const leaves = leavesOf(tree);
  const selected: Leaf = leaves.find((l) => l.id === selectedId) ?? leaves[0];

  // ?leaf=<id>: selected in an effect, not as the initial state, so it also applies when the page is shown
  // again with its state kept (React Activity) or on a link to the page already open. An id that is not one
  // of this tree's leaves leaves the selection as it is. Asked once: the ask is cleared after it is read.
  const leafIds = leaves.map((l) => l.id).join(" ");
  useEffect(() => {
    if (!ask) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-off ask from the address, read once
    if (leafIds.split(" ").includes(ask.id)) setSelectedId(ask.id);
    setAsk(null);
  }, [ask, leafIds, setAsk]);
  const roadName = say(tree.roads.find((r) => r.key === selected.road)!.name);

  // Focus: a panel opened from the keyboard takes it on its heading; closed with × or Esc, it goes back
  // to the node that opened the panel.
  const opener = useRef<string | null>(null);
  const toHeading = useRef(false);
  const aside = useRef<HTMLElement>(null);
  const close = (back: boolean) => {
    setOpen(false);
    const id = opener.current;
    if (back && id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.focus());
  };
  useEffect(() => {
    if (!open || !wide || !toHeading.current) return;
    toHeading.current = false;
    const id = requestAnimationFrame(() => aside.current?.querySelector<HTMLElement>("h2")?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, wide]);

  // Esc closes the side panel (the sheets close on Esc themselves).
  useEffect(() => {
    if (!open || !wide) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const centre: CentreView = useMemo(() => {
    const c = tree.centre;
    const title = c.degree ? (c.degree.university ? `${c.degree.school} × ${shortUniversity(c.degree.university)}` : c.degree.school) : t("Your degree");
    const sub = c.degreeEnd === null ? t("Add your graduation month") : c.diploma ? t("Degree ends {month}", { month: monthYear(locale, c.degreeEnd) }) : t("Graduating {month}", { month: monthYear(locale, c.degreeEnd) });
    const local = c.degree?.name ? names.degree(c.degree.name) : null;
    return { title, name: c.degree?.name ?? null, local: local?.en ? local.name : null, sub };
  }, [tree, t, locale, names]);

  const state: MapState = {
    tree,
    selected,
    open,
    choose: (id) => {
      const road = id.startsWith("road:") ? tree.roads.find((r) => `road:${r.key}` === id) : null;
      setSelectedId(road ? road.leaves[0].id : id);
      opener.current = id;
      // Enter or Space on a focused node (a mouse click does not show the focus ring).
      if (!open) toHeading.current = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible");
      setOpen(true);
    },
    focused,
    setFocused,
    reduce,
    played,
    centreShown,
  };

  const panel = (
    <>
      <PanelBand leaf={selected} roadName={roadName} onClose={() => close(true)} />
      <PanelBody leaf={selected} />
    </>
  );

  return (
    <MapProvider value={state}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-(--land-body)">{t("Showing: {leaf}", { leaf: say(selected.name) })}</p>
        <PathTimeline leaf={selected} />
      </div>

      <section aria-label={t("Map of your roads")} className="flex flex-col gap-3">
        {wide ? (
          <div className="-mx-4 flex justify-center gap-2">
            <div className="shrink-0">
              <RadialMap tree={tree} centre={centre} onPaneClick={() => setOpen(false)} />
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              {open && (
                <motion.aside
                  key="panel"
                  ref={aside}
                  aria-label={say(selected.name)}
                  className="flex w-[400px] min-w-[360px] shrink flex-col overflow-y-auto rounded-2xl border border-(--land-line) bg-(--land-card)"
                  style={{ height: 640 }}
                  initial={reduce ? { opacity: 1 } : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 24, transition: { duration: DURATION.fast, ease: EASE_OUT } }}
                  transition={reduce ? { duration: 0 } : transitions.sheet}
                >
                  {panel}
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        ) : radial ? (
          <div className={RADIAL_FIT}>
            <RadialMap tree={tree} centre={centre} onPaneClick={() => setOpen(false)} />
          </div>
        ) : (
          <ColumnTree tree={tree} centre={centre} />
        )}
      </section>

      <Sheet open={open && !wide} onOpenChange={(o) => !o && setOpen(false)}>
        <SheetContent side={radial ? "right" : "bottom"} showCloseButton={false} className={cn("gap-0 overflow-y-auto bg-(--land-card) p-0", !radial && "h-[85svh]! rounded-t-2xl")}>
          <PanelBand leaf={selected} roadName={roadName} onClose={() => setOpen(false)} title={(c) => <SheetTitle className="text-(--r-on)!">{c}</SheetTitle>} />
          <PanelBody leaf={selected} />
        </SheetContent>
      </Sheet>

      <Sources facts={facts} dates={dates} index={{ n: model.data.programmes.length, built: model.data.builtAt }} mom={momOf(tree)} />
    </MapProvider>
  );
}

/** MOM's EP page and the day it was read, from the Employment Pass leaf. */
function momOf(tree: Tree): { url: string; read: string } | null {
  const ep = leavesOf(tree).find((l) => l.key === "ep");
  if (ep?.panel.kind !== "ep") return null;
  const b = ep.panel.pass.basis;
  return b.url && b.read ? { url: b.url, read: b.read } : null;
}

function Page({ stand, facts, dates, ready, ask, setAsk }: { stand: StandProps; facts: NextStepsFacts; dates: SourceDates; ready: boolean; ask: LeafAsk; setAsk: SetLeafAsk }) {
  const t = useT();
  const names = useSiteNames();
  const storeReady = usePlanStore((s) => s.ready);
  const answers = usePlanStore((s) => s.answers);
  const status = useResultsData((s) => s.status);
  // Whether the scores were already in memory: if not, the centre shows alone while they load.
  const [cached] = useState(() => useResultsData.getState().data !== null);
  const radial = useMediaQuery("(min-width: 800px)");
  const head = useDegreeHead(stand, answers);
  const empty = storeReady && !head;
  const headName = head?.name ? names.degree(head.name) : null;
  const waiting: CentreView | null = head
    ? { title: head.university ? `${head.school} × ${shortUniversity(head.university)}` : head.school, name: head.name, local: headName?.en ? headName.name : null, sub: t("Loading programmes") }
    : null;

  return (
    <div className="flex flex-col gap-10">
      <ExampleBannerUi />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-heading text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">{t("Roads from your degree")}</h1>
        {head && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{head.university ? `${head.school} × ${shortUniversity(head.university)}` : head.school}</Badge>
            {head.field && <Badge variant="outline">{t(head.field)}</Badge>}
          </div>
        )}
        {storeReady && (
          <Button variant="ghost" size="sm" className="sm:ml-auto" render={<Link href="/profile" />} nativeButton={false}>
            {t("Edit answers")}
          </Button>
        )}
      </header>
      {status === "error" ? (
        <Failed />
      ) : empty ? (
        <Empty />
      ) : ready ? (
        <Ready facts={facts} dates={dates} centreShown={!cached} ask={ask} setAsk={setAsk} />
      ) : waiting ? (
        radial ? (
          <div className={RADIAL_FIT}>
            <RadialWaiting centre={waiting} />
          </div>
        ) : (
          <ColumnWaiting centre={waiting} />
        )
      ) : null}
      {(empty || status === "error") && <Sources facts={facts} dates={dates} index={null} mom={null} />}
    </div>
  );
}

/**
 * Reads ?leaf=<id> into the ask, then strips it from the address, so Back or a revisit doesn't ask again.
 * Watches the query (a link to this page while it is open runs no mount effect), under its own Suspense
 * boundary so the page stays prerendered.
 */
function LeafParam({ setAsk }: { setAsk: SetLeafAsk }) {
  const leaf = useSearchParams().get("leaf");
  useEffect(() => {
    if (!leaf) return;
    setAsk((a) => ({ id: leaf, n: (a?.n ?? 0) + 1 }));
    const url = new URL(window.location.href);
    url.searchParams.delete("leaf");
    try {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  }, [leaf, setAsk]);
  return null;
}

export type NextStepsProps = { stand: StandProps; facts: NextStepsFacts; dates: SourceDates };

/** The map and everything with it, without the page's ground: /plan's Map tab mounts it inside its own frame. */
export function NextStepsBody({ stand, facts, dates }: NextStepsProps) {
  const [ask, setAsk] = useState<LeafAsk>(null);
  useEffect(() => {
    // ?example=<id> before the answers are read, so the example's answers are the first ones shown.
    applyExampleFromUrl();
    startPlanStore();
    useResultsData.getState().load();
  }, []);
  return (
    <MotionConfig reducedMotion="user" transition={transitions.enter}>
      <Suspense fallback={null}>
        <LeafParam setAsk={setAsk} />
      </Suspense>
      <StandProvider props={stand}>{(ready) => <Page stand={stand} facts={facts} dates={dates} ready={ready} ask={ask} setAsk={setAsk} />}</StandProvider>
    </MotionConfig>
  );
}

/** The /next-steps page: the map on the homepage's ground, under the fixed header. */
export function NextStepsApp(props: NextStepsProps) {
  return (
    <div className="ui min-h-svh bg-(--land-ground) text-foreground">
      <div className="home-wrap pt-[80px] pb-20 sm:pt-[112px] sm:pb-28">
        <NextStepsBody {...props} />
      </div>
    </div>
  );
}

