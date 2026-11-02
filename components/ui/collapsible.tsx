"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react"

import { transitions } from "@/lib/motion"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

/**
 * Fades and slides in with Motion (lib/motion.ts); Base UI waits for the fade before it hides the panel.
 * With reduced motion it opens and closes at once.
 */
function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  const reduce = useReducedMotion()
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      render={(renderProps, state) => (
        <motion.div
          {...(renderProps as HTMLMotionProps<"div">)}
          initial={{ opacity: 0, y: -4 }}
          animate={state.open ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
          transition={reduce ? { duration: 0 } : state.open ? transitions.enter : transitions.exit}
        />
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
