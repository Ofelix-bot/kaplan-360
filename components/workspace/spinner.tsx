"use client";

import { LoaderCircleIcon } from "lucide-react";
import { motion } from "motion/react";

/** A turning loader icon (Motion; with reduced motion on it stays still). */
export function Spinner({ className }: { className?: string }) {
  return (
    <motion.span className="inline-flex" animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }} aria-hidden>
      <LoaderCircleIcon className={className ?? "size-4"} />
    </motion.span>
  );
}
