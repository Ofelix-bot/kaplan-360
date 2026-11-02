"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/** Fades its content up once, the first time it scrolls into view. */
export default function Reveal({
  as: Tag = "div",
  className = "",
  index,
  children,
}: {
  as?: ElementType;
  className?: string;
  /** Position in a group; each step delays the entrance by 60ms (stagger). */
  index?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={index ? ({ "--i": index } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
