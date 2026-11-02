"use client";

import { useRef } from "react";
import { useInView } from "motion/react";

// Kaplan's graduates in Singapore, cumulative: three bars with their counts over them and their years
// under them, the latest solid. Once half the picture is on screen the bars grow one after another and
// stay (globals.css .hb-grads); with the site's pause or reduced motion they are drawn at once.

export function GradsVisual({ bars }: { bars: { value: string; n: number; year: string }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const go = useInView(box, { once: true, amount: 0.5 });
  const top = Math.max(...bars.map((b) => b.n));
  return (
    <div ref={box} className="hb-v hb-grads" data-go={go || undefined}>
      <div className="hb-grads-plot">
        {bars.map((b, i) => (
          <div key={b.year} className="hb-grads-col" data-last={i === bars.length - 1 || undefined}>
            <span className="hb-grads-value" style={{ animationDelay: `${i * 0.55 + 0.6}s` }}>
              {b.value}
            </span>
            <span className="hb-grads-bar" style={{ height: `${(b.n / top) * 78}%`, animationDelay: `${i * 0.55}s` }} />
          </div>
        ))}
      </div>
      <div className="hb-grads-years">
        {bars.map((b) => (
          <span key={b.year}>{b.year}</span>
        ))}
      </div>
    </div>
  );
}
