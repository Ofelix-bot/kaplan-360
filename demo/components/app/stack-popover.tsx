"use client"

import { LayersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import report from "@/lib/stack-report.json"
import pkg from "@/package.json"

const v = (name: keyof typeof pkg.dependencies) => pkg.dependencies[name]

const STACK = [
  { job: "Components", name: "shadcn/ui, Nova style", detail: `Base UI ${v("@base-ui/react")}, source in components/ui` },
  { job: "Icons", name: "Lucide", detail: `lucide-react ${v("lucide-react")}` },
  { job: "Animation", name: "Motion", detail: `motion ${v("motion")}` },
  { job: "Layout", name: "react-resizable-panels", detail: v("react-resizable-panels") },
  { job: "Drag and drop", name: "dnd-kit", detail: `core ${v("@dnd-kit/core")}, sortable ${v("@dnd-kit/sortable")}` },
  { job: "State", name: "Zustand", detail: v("zustand") },
]

/** The stack, one library per job, and the dependency check's result (scripts/check-deps.mjs). */
export function StackPopover() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        <LayersIcon />
        <span className="hidden sm:inline">Stack</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>How this page is built</PopoverTitle>
          <PopoverDescription>One library for each job, each installed at one version.</PopoverDescription>
        </PopoverHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
          {STACK.map((row) => (
            <div key={row.job} className="contents">
              <dt className="text-muted-foreground">{row.job}</dt>
              <dd>
                <span className="font-medium">{row.name}</span>{" "}
                <span className="text-muted-foreground">{row.detail}</span>
              </dd>
            </div>
          ))}
        </dl>
        <Separator />
        <p className="text-xs text-muted-foreground">
          {report.production.packages} packages ship with the page,{" "}
          {report.production.duplicates.length === 0
            ? "none at two versions."
            : `${report.production.duplicates.length} at two versions.`}{" "}
          Checked {report.checked} by <code className="text-foreground">npm run check:deps</code>.
        </p>
      </PopoverContent>
    </Popover>
  )
}
