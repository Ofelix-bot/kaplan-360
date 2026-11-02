"use client"

import { MotionConfig } from "motion/react"

import { transitions } from "@/lib/motion"

/** "user": with the OS's reduce-motion setting on, movement is dropped and fades stay. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={transitions.enter}>
      {children}
    </MotionConfig>
  )
}
