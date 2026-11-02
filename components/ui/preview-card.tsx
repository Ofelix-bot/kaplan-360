"use client"

import * as React from "react"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"
import { cn } from "cn"

// A preview of a link's destination, shown while the pointer rests on the link (or it has focus).
// The link stays the way in: the card adds a look, not actions.

function PreviewCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />
}

function PreviewCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />
}

function PreviewCardContent({
  className,
  side = "top",
  align = "center",
  sideOffset = 8,
  ...props
}: PreviewCardPrimitive.Popup.Props & Pick<PreviewCardPrimitive.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={12} className="isolate z-50">
        <PreviewCardPrimitive.Popup
          data-slot="preview-card-content"
          className={cn(
            "z-50 w-80 origin-(--transform-origin) overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-hidden transition-[scale,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { PreviewCard, PreviewCardContent, PreviewCardTrigger }
