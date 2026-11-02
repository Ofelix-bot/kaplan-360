"use client";

import { motion } from "motion/react";
import { appear, useReduce } from "./use-clock";

// A heading that settles into place as it scrolls into view (10px, half a second, once): the only
// motion the screens use to hand over to each other. With reduced motion it is simply there.

export function Settle({ className, children }: { className?: string; children: React.ReactNode }) {
  const reduce = useReduce();
  return (
    <motion.div
      data-still
      className={className}
      initial={{ opacity: 0, y: 10 }}
      // With reduced motion it shows at once, wherever it is.
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, ease: appear }}
    >
      {children}
    </motion.div>
  );
}
