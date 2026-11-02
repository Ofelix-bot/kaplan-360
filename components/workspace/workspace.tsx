"use client";

import { useEffect, useState } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SlidersHorizontalIcon } from "lucide-react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import { useT } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/lib/use-media-query";
import { useWorkspace } from "@/lib/workspace/store";
import { FilterPanel } from "./filter-panel";
import { useModel } from "./model";
import { ProgrammeDetail } from "./programme-detail";
import { ResultsBody, ResultsHeader } from "./results-pane";
import { ShortlistPanel } from "./shortlist-panel";
import { SEGMENT } from "./skin";
import { WorkspaceDnd } from "./workspace-dnd";

// The programmes view. Wide screens: three panels the student can resize (filters, results, and the
// selected programme over the ranked shortlist), each scrolling on its own; sizes are kept. Phones:
// results and shortlist as tabs, the filters and a programme's detail in sheets.

/** The resize handles: a grip at 3:1, the line purple while hovered, focused or dragged. */
const HANDLE = "bg-border transition-colors hover:bg-primary/50 focus-visible:bg-primary data-[separator=active]:bg-primary [&>div]:bg-(--ui-input)";
/** Behind the sheets: dims the page more on the black canvas, where a light dim wouldn't show. */
const OVERLAY = "bg-black/40 dark:bg-black/70";

/**
 * The last press of the hero's button a layout acted on. Outside React, so a layout mounted by that
 * press (from the Applications view, or while loading) still acts on it and a remount doesn't again.
 */
let filtersHandled = 0;

/** Saves a group's layout when the student resized it (not on mount or a window resize). */
function useLayout(group: string) {
  const layout = useWorkspace((s) => s.layouts[group]);
  const save = useWorkspace((s) => s.saveLayout);
  return {
    defaultLayout: layout,
    onLayoutChanged: (next: Layout, meta: LayoutChangedMeta) => {
      if (meta.isUserInteraction) save(group, meta.requestedLayout ?? next);
    },
  };
}

function DesktopWorkspace() {
  const t = useT();
  const selectedId = useWorkspace((s) => s.selectedId);
  const select = useWorkspace((s) => s.select);
  const filtersRef = usePanelRef();
  const [filtersHidden, setFiltersHidden] = useState(false);
  const main = useLayout("workspace");
  const side = useLayout("side");

  // The hero's button: the filters panel back in view, and (with no sentence box to focus) its first control.
  const filtersRequest = useWorkspace((s) => s.filtersRequest);
  const sentence = useModel().sentence;
  useEffect(() => {
    const panel = filtersRef.current;
    if (filtersRequest === filtersHandled || !panel) return;
    filtersHandled = filtersRequest;
    if (panel.isCollapsed()) panel.expand();
    if (!sentence) document.getElementById("results-filters")?.focus({ preventScroll: true });
  }, [filtersRequest, filtersRef, sentence]);

  const toggleFilters = () => {
    const panel = filtersRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

  return (
    <ResizablePanelGroup id="workspace" orientation="horizontal" className="min-h-0 flex-1" {...main}>
      <ResizablePanel id="filters" defaultSize="24" minSize={272} maxSize="36" collapsible collapsedSize={0} className="bg-(--rs-panel)" panelRef={filtersRef} onResize={(size) => setFiltersHidden(size.inPixels < 1)}>
        <ScrollArea className="h-full">
          <FilterPanel />
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle withHandle className={HANDLE} />
      <ResizablePanel id="results" defaultSize="40" minSize={360}>
        <div className="flex h-full flex-col">
          <ResultsHeader
            start={
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={toggleFilters} aria-label={filtersHidden ? t("Show filters") : t("Hide filters")} />}>
                  {filtersHidden ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
                </TooltipTrigger>
                <TooltipContent>{filtersHidden ? t("Show filters") : t("Hide filters")}</TooltipContent>
              </Tooltip>
            }
          />
          <ScrollArea className="min-h-0 flex-1">
            <ResultsBody onSelect={select} />
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle className={HANDLE} />
      <ResizablePanel id="side" defaultSize="36" minSize={360}>
        <ResizablePanelGroup id="side" orientation="vertical" {...side}>
          <ResizablePanel id="detail" defaultSize="64" minSize={220}>
            <ScrollArea className="h-full">
              <ProgrammeDetail id={selectedId} />
            </ScrollArea>
          </ResizablePanel>
          <ResizableHandle withHandle className={HANDLE} />
          <ResizablePanel id="shortlist" defaultSize="36" minSize={150}>
            <ShortlistPanel onSelect={select} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function MobileWorkspace() {
  const t = useT();
  const select = useWorkspace((s) => s.select);
  const selectedId = useWorkspace((s) => s.selectedId);
  const { answers, current } = useModel();
  const [tab, setTab] = useState("results");
  const [detailOpen, setDetailOpen] = useState(false);
  // Arriving with ?compare=: the shortlist tab, where the Compare sheet lives, so it can open.
  const compare = useWorkspace((s) => s.compare);
  const [compareFor, setCompareFor] = useState<string[] | null>(null);
  if (compare && compare !== compareFor) {
    setCompareFor(compare);
    setTab("shortlist");
  }
  // Arriving from "I have an idea": the filters sheet opens on the sentence box (it takes the focus).
  const askFocus = useWorkspace((s) => s.askFocus);
  // Open from the start when the hero's button was pressed before this layout mounted.
  const [filtersOpen, setFiltersOpen] = useState(() => useWorkspace.getState().filtersRequest !== filtersHandled);
  const [askedFor, setAskedFor] = useState(false);
  if (askFocus && !askedFor) {
    setAskedFor(true);
    setFiltersOpen(true);
  }
  // The hero's button: the filters sheet opens, each time it is pressed.
  useEffect(() => {
    filtersHandled = useWorkspace.getState().filtersRequest;
    return useWorkspace.subscribe((s, prev) => {
      if (s.filtersRequest === prev.filtersRequest) return;
      filtersHandled = s.filtersRequest;
      setFiltersOpen(true);
    });
  }, []);
  // Arriving on one programme (/results?programme=…): its detail opens once.
  const openDetail = useWorkspace((s) => s.openDetail);
  const [openedFor, setOpenedFor] = useState(false);
  if (openDetail && selectedId && !openedFor) {
    setOpenedFor(true);
    setDetailOpen(true);
  }
  useEffect(() => {
    if (openedFor) useWorkspace.getState().setOpenDetail(false);
  }, [openedFor]);
  const active = (current.field ? 1 : 0) + current.countries.length + current.universities.length + (current.budget !== null ? 1 : 0) + (current.intake && current.intake !== "any" ? 1 : 0);

  const open = (id: string) => {
    select(id);
    setDetailOpen(true);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-0">
      <div className="sticky top-(--ui-header) z-30 flex items-center gap-2 border-b border-(--rs-line-soft) bg-(--rs-glass) px-3 py-2 backdrop-blur-md">
        <TabsList>
          <TabsTrigger value="results" className={SEGMENT}>
            {t("Programme list")}
          </TabsTrigger>
          <TabsTrigger value="shortlist" className={SEGMENT}>
            {t("Shortlist")}
            {answers.shortlist.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 tabular-nums">
                {answers.shortlist.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger render={<Button variant="outline" size="sm" className="ml-auto" />}>
            <SlidersHorizontalIcon />
            {t("Filters")}
            {active > 0 && <Badge className="h-4 px-1.5 tabular-nums">{active}</Badge>}
          </SheetTrigger>
          <SheetContent side="left" overlayClassName={OVERLAY} className="gap-0 border-(--rs-line-soft) p-0 data-[side=left]:w-[92vw]">
            <SheetHeader className="border-b border-(--rs-line-soft)">
              <SheetTitle>{t("Filters")}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FilterPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <TabsContent value="results">
        <ResultsHeader />
        <ResultsBody onSelect={open} />
      </TabsContent>
      <TabsContent value="shortlist" className="min-h-[60dvh]">
        <ShortlistPanel onSelect={open} />
      </TabsContent>
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" overlayClassName={OVERLAY} className="max-h-[88dvh] gap-0 rounded-t-2xl border-(--rs-line-soft) p-0">
          <SheetTitle className="sr-only">{t("Programme details")}</SheetTitle>
          <div className="min-h-0 overflow-y-auto pt-6">
            <ProgrammeDetail id={selectedId} />
          </div>
        </SheetContent>
      </Sheet>
    </Tabs>
  );
}

export function Workspace() {
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const { results } = useModel();
  const selectedId = useWorkspace((s) => s.selectedId);
  const select = useWorkspace((s) => s.select);
  const first = results.list[0]?.p.id;

  // The wide layout opens on the top result, so the detail panel isn't empty.
  useEffect(() => {
    if (desktop && !selectedId && first) select(first);
  }, [desktop, selectedId, first, select]);

  return <WorkspaceDnd>{desktop ? <DesktopWorkspace /> : <MobileWorkspace />}</WorkspaceDnd>;
}
