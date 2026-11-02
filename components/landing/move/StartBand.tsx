"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { START } from "@/content/move.en";
import { closeExampleNow, exampleHref, openExampleNow } from "@/lib/example-link";
import { Settle } from "../Settle";

// /move's closing band, after 03 Lay it out: a full screen on the night ground with the page's one call
// to action. "Build your profile" is the header's "Start planning" button (globals.css .button
// .button-accent: amber, a pill, the arrow that slides on hover), larger; it goes to /profile with the
// visitor's own answers, so an open worked example is closed first. Under it, Arjun's example in
// /careers, opened first as the Services menu does. The box rules are utilities as well, since .ui's
// scoped preflight would reset the site's .button padding and display here.

export function StartBand() {
  const t = useT();
  return (
    <section
      id="start-band"
      aria-labelledby="start-band-title"
      className="on-dark flex min-h-[calc(100svh-var(--header-h))] items-center bg-(--land-night) py-24 text-(--land-night-ink)"
    >
      <div className="home-wrap flex w-full flex-col items-center gap-6 text-center">
        <Settle className="flex flex-col items-center gap-5">
          <h2 id="start-band-title" className="m-0 min-w-0 font-heading text-[clamp(48px,8vw,128px)] [font-stretch:var(--display-stretch)] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance wrap-break-word">
            {t(START.title)}
          </h2>
          <p className="m-0 max-w-[40ch] text-[18px] leading-[1.55] text-pretty text-(--land-night-body) sm:text-xl">{t(START.line)}</p>
        </Settle>
        <Link
          href="/profile"
          onClick={() => closeExampleNow()}
          className="button button-accent mt-4 inline-flex min-h-16 items-center gap-3 rounded-full bg-(--accent) px-10 hover:bg-[#ffc46b] py-4 text-[20px] font-bold text-(--accent-text) no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid sm:text-[22px]"
        >
          {t(START.go)} <ArrowRightIcon className="arrow" size={22} aria-hidden="true" />
        </Link>
        <Link
          href={exampleHref("/careers")}
          onClick={() => {
            openExampleNow("arjun");
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[17px] font-semibold text-(--land-night-ink) underline decoration-current/40 underline-offset-4 transition-[text-decoration-color] duration-200 outline-none hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid motion-reduce:transition-none"
        >
          {t(START.example)}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
