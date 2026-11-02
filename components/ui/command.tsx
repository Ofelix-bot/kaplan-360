"use client"

import * as React from "react"
import { Autocomplete } from "@base-ui/react/autocomplete"
import { cn } from "cn"

// A searchable list of commands, shown inline (no popup of its own) inside a dialog: Base UI's
// autocomplete in its "command palette" form. Arrow keys move the highlight, Enter runs the
// highlighted item's onClick, typing filters by each item's label.

/** The root: pass `items` (flat, or groups of `{ items }`) and keep it `open` and `inline`. */
const Command = Autocomplete.Root

function CommandInput({ className, ...props }: React.ComponentProps<typeof Autocomplete.Input>) {
  return (
    <Autocomplete.Input
      data-slot="command-input"
      className={cn(
        "h-12 w-full border-0 bg-transparent px-1 text-base outline-hidden placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof Autocomplete.List>) {
  return <Autocomplete.List data-slot="command-list" className={cn("flex flex-col gap-2 p-2", className)} {...props} />
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof Autocomplete.Group>) {
  return <Autocomplete.Group data-slot="command-group" className={cn("flex flex-col", className)} {...props} />
}

function CommandGroupLabel({ className, ...props }: React.ComponentProps<typeof Autocomplete.GroupLabel>) {
  return <Autocomplete.GroupLabel data-slot="command-group-label" className={cn("px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />
}

const CommandCollection = Autocomplete.Collection

function CommandItem({ className, ...props }: React.ComponentProps<typeof Autocomplete.Item>) {
  return (
    <Autocomplete.Item
      data-slot="command-item"
      className={cn(
        "flex cursor-default items-center gap-3 rounded-lg px-2 py-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof Autocomplete.Empty>) {
  return <Autocomplete.Empty data-slot="command-empty" className={cn("px-4 py-6 text-center text-sm text-muted-foreground empty:hidden empty:p-0", className)} {...props} />
}

export { Command, CommandCollection, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList }
