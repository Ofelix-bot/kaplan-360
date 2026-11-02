"use client";

import { MotionConfig } from "motion/react";

// Motion follows the visitor's reduced-motion setting everywhere on /move (as on the tool pages):
// transforms are skipped and only opacity changes. Renders no element, so .move-page stays a direct
// child of <main> for the header rules (globals.css).

export function MoveMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
