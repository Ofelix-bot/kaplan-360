"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"
import { cn } from "cn"

// Short confirmations ("Copied", "Order reset") that stack in a corner: the newest in front, older
// ones peeking behind it, all spread out while the pointer is over them. Swipe or × to dismiss.
// Add one from anywhere with `toast.add({ title, description })`. Stacking follows Base UI's own
// example (the --toast-* variables it sets on each toast).

const toast = ToastPrimitive.createToastManager()

function ToastList({ closeLabel }: { closeLabel: string }) {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((t) => (
    <ToastPrimitive.Root
      key={t.id}
      toast={t}
      data-slot="toast"
      className={cn(
        "[--gap:0.625rem] [--peek:0.6rem] [--scale:calc(max(0,1-(var(--toast-index)*0.08)))] [--shrink:calc(1-var(--scale))] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))]",
        "absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] w-full origin-bottom select-none",
        "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))]",
        "rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "h-[var(--height)] data-expanded:h-[var(--toast-height)] data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))]",
        "data-limited:opacity-0 data-ending-style:opacity-0 data-starting-style:[transform:translateY(150%)] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "[transition:transform_0.45s_cubic-bezier(0.22,1,0.36,1),opacity_0.3s,height_0.15s]"
      )}
    >
      <ToastPrimitive.Content className="flex items-start gap-3 overflow-hidden px-4 py-3 transition-opacity duration-200 data-behind:opacity-0 data-expanded:opacity-100">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-amber" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastPrimitive.Title className="text-sm leading-snug font-medium" />
          <ToastPrimitive.Description className="text-xs text-muted-foreground" />
        </div>
        <ToastPrimitive.Action className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted" />
        <ToastPrimitive.Close aria-label={closeLabel} className="-mr-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <XIcon className="size-3.5" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ))
}

/** Where the toasts appear: bottom right, above the page's floating navigation on phones. */
function Toaster({ closeLabel = "Close" }: { closeLabel?: string }) {
  return (
    <ToastPrimitive.Provider toastManager={toast} limit={3} timeout={4500}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className="fixed right-4 bottom-24 z-[60] mx-auto w-[calc(100vw-2rem)] sm:right-6 sm:bottom-6 sm:w-[22rem]"
        >
          <ToastList closeLabel={closeLabel} />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

export { toast, Toaster }
