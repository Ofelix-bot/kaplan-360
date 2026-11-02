"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { PATCH } from "@/content/move.en";
import { Settle } from "../Settle";

// /move's one line directly under the hero: what Kaplan 360++ is beside Kaplan 360. It settles in as it
// comes into view (../Settle.tsx); without scripts it is shown ([data-still], MovePage's noscript).

export function Patch() {
  const t = useT();
  return (
    <div className="bg-(--land-ground) pt-10 pb-4 sm:pt-14">
      <Settle className="home-wrap">
        <p className="m-0 max-w-[44ch] font-heading text-[clamp(20px,2.2vw,30px)] [font-stretch:var(--display-stretch)] leading-[1.3] font-bold text-balance">{t(PATCH.line)}</p>
      </Settle>
    </div>
  );
}
