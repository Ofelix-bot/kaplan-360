import type { ReactNode } from "react";
import { cn } from "cn";

// A section whose giant headline stays put while its cards scroll up over it. From 900px the
// headline block sticks under the header and the in-page band (top: header + band) and the
// children, on a higher layer, start a little over it and pass across it, set left, right and
// centre in turn. Below 900px it is a plain stack. CSS only: no scroll handlers.
// Ancestors must not clip (overflow hidden) or sticky stops working.

export function StickyHeadlineSection({
  id,
  eyebrow,
  headline,
  intro,
  children,
  className,
}: {
  id: string;
  eyebrow: ReactNode;
  headline: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const title = `${id}-title`;
  return (
    <section id={id} aria-labelledby={title} className={cn("relative isolate scroll-mt-16", className)}>
      <div
        className={cn(
          "home-wrap relative z-0 flex flex-col items-center gap-5 py-14 text-center",
          "min-[900px]:sticky min-[900px]:top-[calc(var(--header-h)+var(--band-h))] min-[900px]:h-[min(640px,calc(100svh-var(--header-h)-var(--band-h)))] min-[900px]:justify-center min-[900px]:py-0",
        )}
      >
        <p className="m-0 text-[13px] font-medium text-(--muted) sm:text-sm">{eyebrow}</p>
        <h2 id={title} className="m-0 min-w-0 font-heading text-[clamp(48px,9.6vw,148px)] [font-stretch:var(--display-stretch)] wrap-break-word leading-[0.95] font-extrabold tracking-[-0.02em] text-balance text-inherit">
          {headline}
        </h2>
        {intro && <div className="m-0 max-w-[560px] text-[17px] leading-[1.55] text-pretty text-(--land-body)">{intro}</div>}
      </div>
      <div
        className={cn(
          "home-wrap relative z-10 flex flex-col gap-6 pb-16",
          "min-[900px]:-mt-[min(300px,30svh)] min-[900px]:gap-[120px] min-[900px]:pb-[240px]",
          "min-[900px]:[&>*:nth-child(3n+1)]:self-start min-[900px]:[&>*:nth-child(3n+2)]:self-end min-[900px]:[&>*:nth-child(3n)]:self-center",
        )}
      >
        {children}
      </div>
    </section>
  );
}
