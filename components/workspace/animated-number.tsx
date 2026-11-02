"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

/** A count that eases to its new value, so a change in results reads as a change. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { duration: 0.3, bounce: 0 });
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString("en-SG"));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
