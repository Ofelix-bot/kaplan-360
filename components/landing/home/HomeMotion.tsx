"use client";

import { MotionConfig } from "motion/react";

// Motion follows the system's reduced-motion setting everywhere on the homepage.

export function HomeMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
