// Every timing of the landing sections (/move; once the homepage's opening), in one place. Seconds
// unless marked; fractions are of a loop. Each loop runs on one clock (use-clock.ts), so the parts it
// drives stay in step.

/** Walking: the road's two walkers and the walked road behind them. */
export const EASE_WALK = [0.6, 0, 0.3, 1] as const;

/** The Opener plays once, when its top is in the upper 60% of the screen: at load, since it comes first. */
export const OPENER = {
  margin: "0px 0px -40% 0px",
  /** Bubble i (0-based) starts at first + step × i, rising from 14px below over 0.7s. */
  bubble: { first: 0.4, step: 0.9, duration: 0.7, rise: 14 },
  /** Then the six that ask fade back together, once the seventh (index 6, in by 6.5s) is in; it stays. */
  dim: { at: 7.1, duration: 0.9, to: 0.22 },
  /** The two large lines, each rising from 10px below. */
  lines: { at: [7.7, 8.9], duration: 0.9, rise: 10 },
  more: { at: 10.3, duration: 0.9, rise: 10 },
} as const;

export const OPENER_END = OPENER.more.at + OPENER.more.duration;

/**
 * The split: one 14s loop for both columns (the brief's 18s, about a fifth faster at the user's request,
 * every time scaled alike), picture A then cards B; it starts once half of the first picture is in view.
 */
export const SPLIT = {
  loop: 14,
  amount: 0.5,
  /** Opacity keyframes of the two layers. */
  a: { at: [0, 0.03, 0.4, 0.45], opacity: [0, 1, 1, 0] },
  b: { at: [0.45, 0.5, 0.95, 1], opacity: [0, 1, 1, 0] },
  /** A: each generation of roads draws over 1.4s; delays in seconds. */
  draw: 1.4,
  generations: [0, 0.45, 0.9],
  /** A, left: the six ends appear (scale 0.3 → 1) at 1.4s; right: the one end at 0.9s. */
  endsLeft: 1.4,
  endRight: 0.9,
  pop: 0.3,
  /** A, right: the two outer roads fade to 0.16 (the ones that don't hold). */
  fade: [0.22, 0.28],
  fadeTo: 0.16,
  /** A: the roads undraw while the layer is hidden, ready for the next loop. */
  reset: [0.88, 0.92],
  /** B: rows come in from 18px to the left from 50%, 0.3s apart. */
  rows: { from: 0.5, step: 0.3, duration: 0.3, shift: -18 },
  /**
   * B, right: the last line is struck through and dimmed, by 68%. The last row is in at 62.9%, so the
   * strike starts just after it rather than at 62%. 0.5 rather than 0.45 keeps the text at 4.5:1.
   */
  strike: [0.62, 0.68],
  struckTo: 0.5,
  /** Where a focused or pointed-at card holds the loop: everything in B shown. */
  hold: 0.75,
} as const;

/**
 * 02 · Check plays once, when half of its picture is in view: the split's narrowing picture and its
 * rows, as before, but one after the other on one clock instead of switching places. Six roads draw
 * (1.4s each, the one road on from 0.45s), the two outer ones fade, then the rows come in from 18px to
 * the left 0.3s apart, then the crossed-out line is struck and dimmed. Seconds.
 */
export const CHECK = {
  amount: 0.5,
  draw: 1.4,
  generations: [0, 0.45],
  end: 0.9,
  pop: 0.3,
  /** The two outer roads fade to 0.16 (the ones that don't hold), over the split's 0.84s. */
  fade: [1.9, 2.74],
  fadeTo: 0.16,
  rows: { from: 2.0, step: 0.3, duration: 0.3, shift: -18 },
  /** The strike starts this long after the last row is in and takes the split's 0.84s; 0.5 keeps the text at 4.5:1. */
  strikeGap: 0.1,
  strike: 0.84,
  struckTo: 0.5,
} as const;
