"use client"

import { LayoutPanelLeftIcon, SquareKanbanIcon } from "lucide-react"

import { StackPopover } from "@/components/app/stack-popover"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/lib/store"

/** Sits inside the app's Tabs root: the two tabs switch between the workspace and the board. */
export function SiteHeader() {
  const onBoard = useAppStore((s) => s.shortlist.length)
  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 sm:gap-3 lg:px-4">
      <p className="font-heading text-sm font-semibold whitespace-nowrap">Kaplan 360++</p>
      <TabsList aria-label="View">
        <TabsTrigger value="workspace">
          <LayoutPanelLeftIcon className="max-sm:hidden" />
          Programmes
        </TabsTrigger>
        <TabsTrigger value="board">
          <SquareKanbanIcon className="max-sm:hidden" />
          Applications
          {onBoard > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 tabular-nums">
              {onBoard}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <div className="ml-auto flex items-center gap-1">
        <StackPopover />
        {/* On phones the theme follows the system setting. */}
        <div className="max-sm:hidden">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
