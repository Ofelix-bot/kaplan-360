"use client"

import { CheckIcon, PlusIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { transitions } from "@/lib/motion"
import { useAppStore } from "@/lib/store"

/** The icon swaps with a quick scale and fade, so the change reads as a confirmation. */
function SwapIcon({ on }: { on: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={on ? "on" : "off"}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={transitions.popup}
        className="inline-flex"
      >
        {on ? <CheckIcon /> : <PlusIcon />}
      </motion.span>
    </AnimatePresence>
  )
}

export function ShortlistToggle({
  id,
  name,
  labelled = false,
}: {
  id: string
  name: string
  labelled?: boolean
}) {
  const on = useAppStore((s) => s.shortlist.includes(id))
  const add = useAppStore((s) => s.addToShortlist)
  const remove = useAppStore((s) => s.removeFromShortlist)
  const toggle = () => (on ? remove(id) : add(id))

  if (labelled) {
    return (
      <Button variant={on ? "secondary" : "default"} size="sm" onClick={toggle} aria-pressed={on}>
        <SwapIcon on={on} />
        {on ? "In shortlist" : "Add to shortlist"}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={on ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={toggle}
            aria-pressed={on}
            aria-label={on ? `Remove ${name} from the shortlist` : `Add ${name} to the shortlist`}
          />
        }
      >
        <SwapIcon on={on} />
      </TooltipTrigger>
      <TooltipContent>{on ? "Remove from shortlist" : "Add to shortlist"}</TooltipContent>
    </Tooltip>
  )
}
