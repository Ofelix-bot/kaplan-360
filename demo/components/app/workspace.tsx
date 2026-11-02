"use client"

import { useEffect, useState } from "react"
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SlidersHorizontalIcon } from "lucide-react"
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels"

import { FilterPanel } from "@/components/app/filter-panel"
import { ProgrammeDetail } from "@/components/app/programme-detail"
import { ResultsHeader, ResultsList, useResults } from "@/components/app/results-list"
import { ShortlistPanel } from "@/components/app/shortlist-panel"
import { WorkspaceDnd } from "@/components/app/workspace-dnd"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMediaQuery } from "@/hooks/use-media-query"
import { activeFilterCount } from "@/lib/filter"
import { useAppStore } from "@/lib/store"

/** Saves a group's layout to the store when the student resized it (not on mount or window resize). */
function useLayout(group: string) {
  const layout = useAppStore((s) => s.layouts[group])
  const save = useAppStore((s) => s.saveLayout)
  return {
    defaultLayout: layout,
    onLayoutChanged: (next: Layout, meta: LayoutChangedMeta) => {
      if (meta.isUserInteraction) save(group, meta.requestedLayout ?? next)
    },
  }
}

function DesktopWorkspace() {
  const selectedId = useAppStore((s) => s.selectedId)
  const select = useAppStore((s) => s.select)
  const filtersRef = usePanelRef()
  const [filtersHidden, setFiltersHidden] = useState(false)
  const main = useLayout("workspace")
  const side = useLayout("side")

  const toggleFilters = () => {
    const panel = filtersRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  return (
    <ResizablePanelGroup id="workspace" orientation="horizontal" className="min-h-0 flex-1" {...main}>
      <ResizablePanel
        id="filters"
        defaultSize="22"
        minSize={248}
        maxSize="34"
        collapsible
        collapsedSize={0}
        panelRef={filtersRef}
        onResize={(size) => setFiltersHidden(size.inPixels < 1)}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-11 shrink-0 items-center border-b px-4">
            <h2 className="font-heading text-sm font-semibold">Filters</h2>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <FilterPanel />
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="results" defaultSize="42" minSize={380}>
        <div className="flex h-full flex-col">
          <ResultsHeader
            start={
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={toggleFilters}
                      aria-label={filtersHidden ? "Show filters" : "Hide filters"}
                    />
                  }
                >
                  {filtersHidden ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
                </TooltipTrigger>
                <TooltipContent>{filtersHidden ? "Show filters" : "Hide filters"}</TooltipContent>
              </Tooltip>
            }
          />
          <ScrollArea className="min-h-0 flex-1">
            <ResultsList onSelect={select} />
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="side" defaultSize="36" minSize={360}>
        <ResizablePanelGroup id="side" orientation="vertical" {...side}>
          <ResizablePanel id="detail" defaultSize="62" minSize={220}>
            <ScrollArea className="h-full">
              <ProgrammeDetail id={selectedId} />
            </ScrollArea>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="shortlist" defaultSize="38" minSize={150}>
            <ShortlistPanel onSelect={select} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function MobileWorkspace() {
  const select = useAppStore((s) => s.select)
  const selectedId = useAppStore((s) => s.selectedId)
  const shortlisted = useAppStore((s) => s.shortlist.length)
  const filters = useAppStore((s) => s.filters)
  const [tab, setTab] = useState("results")
  const [detailOpen, setDetailOpen] = useState(false)
  const active = activeFilterCount(filters)

  const open = (id: string) => {
    select(id)
    setDetailOpen(true)
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-0">
      <div className="sticky top-12 z-30 flex items-center gap-2 border-b bg-background px-3 py-2">
        <TabsList>
          <TabsTrigger value="results">Programmes</TabsTrigger>
          <TabsTrigger value="shortlist">
            Shortlist
            {shortlisted > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 tabular-nums">
                {shortlisted}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="sm" className="ml-auto" />}>
            <SlidersHorizontalIcon />
            Filters
            {active > 0 && (
              <Badge className="h-4 px-1.5 tabular-nums">{active}</Badge>
            )}
          </SheetTrigger>
          <SheetContent side="left" className="gap-0 p-0 data-[side=left]:w-[88vw]">
            <SheetHeader className="border-b">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FilterPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <TabsContent value="results">
        <ResultsHeader />
        <ResultsList onSelect={open} />
      </TabsContent>
      <TabsContent value="shortlist" className="min-h-[60dvh]">
        <ShortlistPanel onSelect={open} />
      </TabsContent>
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] gap-0 rounded-t-xl p-0">
          <SheetTitle className="sr-only">Programme details</SheetTitle>
          <div className="min-h-0 overflow-y-auto pt-6">
            <ProgrammeDetail id={selectedId} />
          </div>
        </SheetContent>
      </Sheet>
    </Tabs>
  )
}

export function Workspace() {
  const desktop = useMediaQuery("(min-width: 1024px)", true)
  const results = useResults()
  const selectedId = useAppStore((s) => s.selectedId)
  const select = useAppStore((s) => s.select)

  // On a first visit the wide layout opens on the top result, so the detail panel isn't empty.
  useEffect(() => {
    if (desktop && !selectedId && results.length) select(results[0].id)
  }, [desktop, selectedId, results, select])

  return <WorkspaceDnd>{desktop ? <DesktopWorkspace /> : <MobileWorkspace />}</WorkspaceDnd>
}
