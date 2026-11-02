"use client"

import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useData } from "@/lib/data"
import type { CaseSource } from "@/lib/types"

/** Where a programme's admitted-student figures come from, with each source's caveat. */
export function SourcesPopover({ sources }: { sources: Partial<Record<CaseSource, number>> }) {
  const meta = useData((s) => s.data?.sources)
  if (!meta) return null
  const used = (Object.keys(sources) as CaseSource[]).filter((k) => sources[k])
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="link" size="xs" className="h-auto px-0" />}>
        <InfoIcon />
        About these figures
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>About these figures</PopoverTitle>
          <PopoverDescription>
            Reports that applicants or agencies chose to publish, from 2022 on. They describe past
            admits, not anyone’s chances.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col gap-2.5">
          {used.map((key) => (
            <li key={key} className="flex flex-col gap-0.5">
              <a
                href={meta[key].url}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-4 hover:underline"
              >
                {meta[key].name}
              </a>
              <span className="text-xs text-muted-foreground">
                {sources[key]} admits here. {meta[key].note}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
