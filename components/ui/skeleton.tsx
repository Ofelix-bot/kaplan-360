import { cn } from "cn"

/** A placeholder in the shape of what is loading. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}

export { Skeleton }
