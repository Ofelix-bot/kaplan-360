"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { ParticleHero } from "@/components/shared/ParticleHero";
import { DRAFT } from "@/content/draft";
import { HeroArc } from "./HeroArc";

// /move's hero: the site's dark ground with the moving dots (ParticleHero, words on the left), the
// slogan as the page's one H1, and at the bottom right an amber dash over what the page is. The slogan
// is the campaign's own line: never translated (lang="en", translate="no"), and kept out of the
// messages. Its entrance is CSS (app/[lang]/move/move.css), so it plays from the server's HTML without
// waiting for scripts: the block rises 56px over 1s, then the two lines converge from ±9% (800ms, from
// 1050ms), then the amber ring is drawn as the "°". Once the ring is drawn the hero is marked
// data-played, so coming back to the page (React Activity) doesn't replay it. With reduced motion
// everything is in place from the start. The hero fills the first screen under the header (at least
// 560px): the slogan's block centred on 40% of the screen's height inside a lit ring (./HeroArc.tsx), the
// amber dash and its line at the bottom right. Each slogan line stays one line at every width; the
// second is indented 1em, and the size (--mv-fs, move.css) keeps the block within the page's content, so
// it sits between the same margins as the header. The ring's box (inline, raised, its margins), the second
// line's indent and the size are utilities: .ui's scoped preflight would reset them in move.css.

/** `line`: the message at the bottom right (the English page has its own, DRAFT.move.heroLineEn). */
export function MoveHero({ line: key = DRAFT.move.heroLine }: { line?: string }) {
  const t = useT();
  // The line at the bottom right is two lines, broken after its comma (English ", ", Chinese "，").
  const line = t(key);
  const cut = line.search(/(?<=,) |(?<=，)/);
  const parts = cut > 0 ? [line.slice(0, cut), line.slice(cut).trimStart()] : [line];
  return (
    <ParticleHero as="section" scrim="left" aria-labelledby="move-title" className="mv-hero flex h-[max(560px,100svh)]">
      {/* The hero runs to the bottom of the first screen (it starts under the header), its last stretch easing
          into the ground the seam below starts from, so the screen has no hard edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-[linear-gradient(to_bottom,transparent,var(--hero-base))]" />
      <div
        className="home-wrap relative flex flex-col justify-end pt-[112px] pb-[calc(40px+var(--header-h))] min-[900px]:pt-[140px] min-[900px]:pb-[calc(72px+var(--header-h))]"
        onAnimationEnd={(e) => {
          if (e.animationName === "mv-ring") e.currentTarget.closest(".mv-hero")?.setAttribute("data-played", "");
        }}
      >
        <HeroArc />
        {/* The slogan's block is centred on 40% of the first screen (the hero starts at the top of the page,
            under the header). Its own home-wrap puts the lines where the hero's would. */}
        <div data-arc="block" className="absolute inset-x-0 top-[40svh] -translate-y-1/2">
          <div className="home-wrap mv-rise">
            <h1
              id="move-title"
              lang="en"
              translate="no"
              className="m-0 mx-auto w-fit max-w-full min-w-0 font-heading text-(length:--mv-fs) [font-stretch:var(--display-stretch)] leading-[1.02] font-extrabold tracking-[-0.02em] text-white [text-shadow:0_2px_24px_var(--hero-scrim)]"
            >
              {/* Line 1 is set 1.15× line 2, as on the mock, so the white line holds its own beside the longer lavender one. */}
              <span className="mv-line-1 block text-[1.15em]">
                {/* "360" and its ring never part: no break between the digits and the drawn "°". */}
                <span data-arc="start" className="whitespace-nowrap">
                  360<span className="sr-only">°</span>
                  <svg aria-hidden viewBox="0 0 40 40" className="mv-ring mr-[0.06em] ml-[0.08em] inline-block align-[0.4em]">
                    <circle cx="20" cy="20" r="12" pathLength={100} />
                  </svg>
                </span>{" "}
                clarity.
              </span>
              <span className="mv-line-2 block pl-[1em]">
                <span data-arc="end">One defining leap.</span>
              </span>
            </h1>
          </div>
        </div>
        <div className="mv-side max-w-[400px] self-end min-[900px]:mr-[4%]">
          <span aria-hidden className="block h-1 w-12 rounded-full bg-(--accent)" />
          <p className="m-0 mt-5 text-[17px] leading-[1.45] font-semibold text-pretty text-white [text-shadow:0_1px_12px_var(--hero-scrim)] min-[900px]:text-xl">
            {parts.map((p, i) => (
              <span key={i} className="block">
                {p}
              </span>
            ))}
          </p>
        </div>
      </div>
    </ParticleHero>
  );
}
