import type { DropAnimation } from "@dnd-kit/core"
import type { Transition } from "motion/react"

// One set of curves and timings for every animation in the app. Motion reads them directly;
// dnd-kit's own sorting and drop transitions (CSS strings) are built from the same values.

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

/** Seconds. Motion inside the tools (popups, sheets, drag and drop) stays under 300 ms. Content motion (the
 * menu, cards, carousels, reveals) uses the 550 ms UI curve below; the page entrance has its own. */
export const DURATION = { fast: 0.14, base: 0.2, slow: 0.28 } as const

const bezier = (curve: readonly number[]) => `cubic-bezier(${curve.join(", ")})`

export const transitions = {
  enter: { duration: DURATION.base, ease: EASE_OUT },
  exit: { duration: DURATION.fast, ease: EASE_OUT },
  move: { duration: DURATION.base, ease: EASE_IN_OUT },
  popup: { duration: DURATION.fast, ease: EASE_OUT },
  sheet: { duration: DURATION.slow, ease: EASE_OUT },
  /** Content motion: the Services menu, cards, carousels and reveals (the CSS --motion-ui / --motion-ui-dur). */
  ui: { duration: 0.55, ease: [0.85, 0, 0, 1] },
} satisfies Record<string, Transition>

/** The /results hero's one-time entrance (the template's fadeIn): longer than UI motion on purpose. */
export const ENTRANCE = { duration: 0.6, ease: [0, 0, 0.58, 1] } as const satisfies Transition // CSS ease-out
export const entrance = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } }

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

/** The content UI curve and duration (CSS: --motion-ui, --motion-ui-dur in app/globals.css). */
export const EASE_UI = [0.85, 0, 0, 1] as const
export const DURATION_UI = 0.55

/** Hero lines rising into place (seconds; y in px). */
export const HERO_RISE = { y: 56, duration: 1, ease: EASE_UI } as const
/** The /move slogan's two lines converging (x as a fraction of the line's width; CSS: --motion-converge). */
export const HERO_CONVERGE = { x: 0.09, duration: 0.8, delay: 1.05, ease: [0, -0.01, 0.01, 1] } as const
/** A section or card revealed on scroll (y in px). */
export const REVEAL = { y: 24, duration: DURATION_UI, ease: EASE_UI } as const
