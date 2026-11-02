"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

// Base UI's dialog, unstyled where the callers animate it themselves with Motion (a card that
// morphs into the dialog, a photo that grows out of its thumbnail): they pass `render` to the popup
// and keep the portal mounted while Motion plays the exit (AnimatePresence). The backdrop and
// viewport carry the shared look.

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn("fixed inset-0 z-50 bg-[#100636]/45 backdrop-blur-[2px]", className)}
      {...props}
    />
  )
}

/** A full-screen layer that centres the popup and scrolls when it is taller than the window. */
function DialogViewport({ className, ...props }: DialogPrimitive.Viewport.Props) {
  return (
    <DialogPrimitive.Viewport
      data-slot="dialog-viewport"
      className={cn("fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 sm:p-8", className)}
      {...props}
    />
  )
}

function DialogPopup({ className, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-content"
      className={cn("relative w-full max-w-lg rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-hidden", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-heading text-lg leading-snug font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

export { Dialog, DialogBackdrop, DialogClose, DialogDescription, DialogPopup, DialogPortal, DialogTitle, DialogTrigger, DialogViewport }
