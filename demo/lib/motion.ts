import type { DropAnimation } from "@dnd-kit/core"
import type { Transition } from "motion/react"

// One set of curves and timings for every animation in the app. Motion reads them directly;
// dnd-kit's own sorting and drop transitions (CSS strings) are built from the same values.

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

/** Seconds. UI motion stays under 300 ms. */
export const DURATION = { fast: 0.14, base: 0.2, slow: 0.28 } as const

const bezier = (curve: readonly number[]) => `cubic-bezier(${curve.join(", ")})`

export const transitions = {
  enter: { duration: DURATION.base, ease: EASE_OUT },
  exit: { duration: DURATION.fast, ease: EASE_OUT },
  move: { duration: DURATION.base, ease: EASE_IN_OUT },
  popup: { duration: DURATION.fast, ease: EASE_OUT },
  sheet: { duration: DURATION.slow, ease: EASE_OUT },
} satisfies Record<string, Transition>

/** Popups grow from their trigger: Base UI sets --transform-origin on the positioner. */
export const popupStates = {
  open: { opacity: 1, scale: 1 },
  closed: { opacity: 0, scale: 0.96 },
}

/** For dnd-kit's useSortable `transition` option. */
export const sortableTransition = {
  duration: DURATION.base * 1000,
  easing: bezier(EASE_OUT),
}

/**
 * For dnd-kit's DragOverlay `dropAnimation`. No side effects: dnd-kit would otherwise hide the
 * dragged element and later restore a stale inline opacity over the one Motion animates.
 */
export const dropAnimation: DropAnimation = {
  duration: DURATION.base * 1000,
  easing: bezier(EASE_OUT),
  sideEffects: null,
}
