"use client";

import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { HOW, PATCH, ROAD_CHECKS } from "@/content/move.en";
import { closeExampleNow } from "@/lib/example-link";
import { Settle } from "../Settle";
import { Overline } from "./Overline";

// The English /move page's intro, under the band: the line on Kaplan360 in two lines (the first in a
// paler violet), then "How it works" in four steps: Start with you (to /profile, the closing band's
// "Build your profile", with the visitor's own answers) and 01, 02, 03, each a link to its section. As
// 01's picture, each step hangs from a dot on one line: the first dot filled, 01's and 02's open on a
// tint, 03's dashed and the line into it dashed, as it isn't built yet. Four across from 1024px (the line
// joins the dots only there), two by two from 640px, one column below.

/** The space between the steps' columns, CSS px: the line runs across it to the next dot. */
const GAP = 32;

export function HowItWorks() {
  const t = useT();
  const [first, ...rest] = t(PATCH.line).split(/(?<=\.)\s+/);
  return (
    <section aria-labelledby="how-title" className="bg-(--land-ground) pt-12 pb-20 sm:pt-16 sm:pb-24">
      <div className="home-wrap flex flex-col gap-14">
        <Settle>
          <p className="m-0 font-heading text-[clamp(28px,3.4vw,48px)] [font-stretch:var(--display-stretch)] leading-[1.12] font-bold text-balance">
            <span className="block text-[#8a85a3]">{first}</span>
            {rest.length > 0 && <span className="block">{rest.join(" ")}</span>}
          </p>
        </Settle>
        <div className="flex flex-col gap-6">
          <Overline as="h2" id="how-title">
            {t(HOW.title)}
          </Overline>
          <ol className="m-0 grid list-none gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.steps.map((s, i) => {
              const last = i === HOW.steps.length - 1;
              const body = (
                <>
                  <span className={cn("block text-[14px] leading-5 font-semibold tabular-nums", s.step ? "text-(--accent-ink)" : "text-(--land-body)")}>{s.step ?? (s.label ? t(s.label) : null)}</span>
                  <span className="mt-2 block font-heading text-[22px] [font-stretch:var(--display-stretch)] leading-tight font-bold text-(--text)">{t(s.title)}</span>
                  <span className="mt-3 block max-w-[30ch] text-[15px] leading-[1.6] text-pretty text-(--land-body)">{t(s.body)}</span>
                  {s.soon && <span className="mt-3 inline-block rounded-full bg-(--land-check-bg) px-3 py-1 text-[12px] leading-5 font-semibold text-(--land-check)">{t(ROAD_CHECKS.soon)}</span>}
                </>
              );
              return (
                <li key={s.title} className="relative flex min-w-0 flex-col gap-5">
                  {/* The line on to the next dot, across the column gap: four across only. */}
                  {!last && (
                    <span
                      aria-hidden
                      style={{ width: `calc(100% + ${GAP}px - 18px)` }}
                      className={cn("absolute top-[8px] left-[18px] hidden h-0 border-0 border-t-[2.5px] border-(--brand-ink) lg:block", i === HOW.steps.length - 2 ? "border-dashed" : "border-solid")}
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "relative block size-[18px] shrink-0 rounded-full",
                      i === 0 && "bg-(--brand-ink)",
                      i > 0 && !last && "border-[2.5px] border-solid border-(--brand-ink) bg-(--land-tint)",
                      last && "border-2 border-dashed border-[#a99be6] bg-(--land-ground)",
                    )}
                  />
                  {s.href ? (
                    <a
                      href={s.href}
                      className="-m-3 block rounded-xl p-3 text-inherit no-underline transition-colors duration-200 outline-none hover:bg-(--land-tint) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid motion-reduce:transition-none"
                    >
                      {body}
                    </a>
                  ) : (
                    <div>
                      {body}
                      {s.link && (
                        <Link
                          href="/profile"
                          onClick={() => closeExampleNow()}
                          className="mt-4 inline-block border-0 border-b-2 border-solid border-(--accent) pb-0.5 text-[15px] font-bold text-(--text) no-underline outline-none hover:border-(--accent-ink) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid"
                        >
                          {t(s.link)}
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
