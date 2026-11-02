import type { ReactNode } from "react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { ArrowSquare } from "./ArrowSquare";

// A tile that opens up on hover or keyboard focus: the card grows to 1.04, its picture blurs back
// (blur 16px, opacity .35, scale 1.7), the description slides in from the right and the CTA rises
// from the bottom, all 550ms on the UI curve. Where nothing hovers (touch), and with reduced motion,
// the description and CTA are shown from the start, the picture sits in the flow and stays sharp, and
// nothing moves (the static final state; no words hidden at rest).
// The CTA is a stretched link (its ::after covers the card), so the whole card is one target; the
// `extra` slot (receipt chips, themselves links or buttons) sits above it, never inside it.
// The card clips with overflow: clip, not hidden: a hidden box scrolls, so tabbing onto a chip that still
// waits off to the right scrolled the card sideways, and it stayed scrolled after focus left.
// No state: it renders on the server, and its words come translated from the caller.

export type ExpandCardTone = "night" | "night2" | "brand" | "teal" | "amber" | "card";

const TONE: Record<ExpandCardTone, { root: string; sub: string }> = {
  night: { root: "bg-(--tile-night) text-(--tile-night-ink) border-(--tile-line)", sub: "text-(--tile-night-body)" },
  night2: { root: "bg-(--tile-night-2) text-(--tile-night-ink) border-(--tile-line)", sub: "text-(--tile-night-body)" },
  brand: { root: "on-dark bg-(--tile-brand) text-white border-(--tile-line)", sub: "text-white/85" },
  teal: { root: "on-dark bg-(--tile-teal) text-white border-(--tile-line)", sub: "text-white/90" },
  // The focus ring would vanish on amber: .on-amber (globals.css) makes it dark ink, for the chips too.
  amber: { root: "on-amber bg-(--accent) text-(--accent-text) border-(--tile-line)", sub: "text-(--accent-text)" },
  card: { root: "bg-(--land-card) text-(--text) border-(--land-line)", sub: "text-(--land-body)" },
};

/** Shared by every moving part: one duration, one curve. */
const EASE = "duration-(--motion-ui-dur) ease-(--motion-ui)";
/** Off to the right and transparent until hover or focus, only where something can hover and motion is welcome. */
const HIDE_RIGHT = "[@media(hover:hover)]:motion-safe:opacity-0 [@media(hover:hover)]:motion-safe:translate-x-[115%]";
/** Back in place on hover or focus. */
const SHOW = "group-hover/card:translate-x-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-x-0 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100";

export function ExpandCard({
  label,
  title,
  body,
  visual,
  description,
  cta,
  extra,
  tone = "card",
  headingLevel = 3,
  className,
  id,
}: {
  label: ReactNode;
  title: ReactNode;
  /** Shown under the title at all times (the description waits for hover or focus). */
  body?: ReactNode;
  visual: ReactNode;
  description: ReactNode;
  /** The card's link; a card without one has no stretched link. */
  cta?: { href: string; label: ReactNode; onClick?: () => void };
  extra?: ReactNode;
  tone?: ExpandCardTone;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  id?: string;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const tn = TONE[tone];
  return (
    <article
      id={id}
      className={cn(
        "group/card relative z-0 flex min-h-[420px] flex-col overflow-clip rounded-[14px] border border-solid shadow-[0_0_0_rgba(22,19,43,0)]",
        "transition-[scale,box-shadow]",
        EASE,
        "hover:z-10 hover:shadow-[0_24px_48px_rgba(22,19,43,0.18)] focus-within:z-10 focus-within:shadow-[0_24px_48px_rgba(22,19,43,0.18)]",
        "motion-safe:hover:scale-[1.04] motion-safe:focus-within:scale-[1.04]",
        "[@media(hover:none)]:min-h-[300px] motion-reduce:min-h-[300px]",
        tn.root,
        className,
      )}
    >
      {/* The picture: bottom 56% of the card where something hovers, in the flow on touch and with reduced motion. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none order-2 h-[220px] origin-[50%_70%] transition-[filter,opacity,scale]",
          EASE,
          "[@media(hover:hover)]:motion-safe:absolute [@media(hover:hover)]:motion-safe:inset-x-0 [@media(hover:hover)]:motion-safe:bottom-0 [@media(hover:hover)]:motion-safe:h-[56%]",
          "motion-safe:group-hover/card:opacity-35 motion-safe:group-hover/card:blur-[16px] motion-safe:group-hover/card:scale-[1.7]",
          "[@media(hover:hover)]:motion-safe:group-focus-within/card:opacity-35 [@media(hover:hover)]:motion-safe:group-focus-within/card:blur-[16px] [@media(hover:hover)]:motion-safe:group-focus-within/card:scale-[1.7]",
          "[&>*]:size-full",
        )}
      >
        {visual}
      </div>

      {/* The head: 32px above the label, 16 between label and title, 8 from title to its words, so the
          label sits with its title and the title with its body (none nearer what precedes it). */}
      <div className="relative order-1 flex flex-col px-7 pt-8 pb-7">
        {/* Sentence case, untracked (the reference's caps are not ported). */}
        <p className={cn("m-0 mb-4 text-[13px] leading-5 font-semibold", tn.sub)}>{label}</p>
        <H className="m-0 mb-2 min-w-0 font-heading text-[23px] [font-stretch:var(--display-stretch)] leading-[1.2] font-bold tracking-[-0.01em] text-balance break-keep wrap-break-word text-inherit">{title}</H>
        {body && <div className="mt-3 mb-2">{body}</div>}
        <div
          className={cn(
            "text-[15px] leading-[1.55] text-pretty transition-[translate,opacity]",
            EASE,
            tn.sub,
            HIDE_RIGHT,
            SHOW,
          )}
        >
          {description}
        </div>
        {extra && (
          <div
            className={cn(
              "relative z-10 mt-4 flex flex-wrap gap-2 transition-[translate,opacity] delay-[60ms]",
              EASE,
              HIDE_RIGHT,
              SHOW,
            )}
          >
            {extra}
          </div>
        )}
      </div>

      {/* The stretched link: static itself, so its ::after spans the card; only its inner span moves. */}
      {cta && (
      <div className="order-3 mt-auto flex justify-end p-6 pt-2">
        <Link
          href={cta.href}
          onClick={cta.onClick}
          className={cn(
            "text-[15px] font-bold text-inherit no-underline outline-none",
            "after:absolute after:inset-0 after:rounded-[inherit] after:content-['']",
            "focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-solid",
            "focus-visible:after:outline-(--focus-ring)",
          )}
        >
          <span
            className={cn(
              "relative inline-flex items-center gap-2.5 transition-[translate,opacity]",
              EASE,
              "[@media(hover:hover)]:motion-safe:opacity-0 [@media(hover:hover)]:motion-safe:translate-y-[180%]",
              SHOW,
            )}
          >
            {cta.label}
            <ArrowSquare />
          </span>
        </Link>
      </div>
      )}
    </article>
  );
}
