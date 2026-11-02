"use client";

import { ArrowRightIcon } from "lucide-react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { useDay } from "@/components/landing/receipts";
import { HOME } from "@/content/home.en";
import { closeExampleNow } from "@/lib/example-link";

/**
 * "Not sure where to start?" in the hero: the one way in, the accent button to /move (Insights), the first
 * step of the guided flow (Insights → Your profile → Compass → Programme finder → Your plan). It is the
 * visitor's own flow, so it closes any open worked example (lib/example-link.ts) and opens none. Then every
 * page and API read behind the site and the latest one's date (lib/read-count.ts), linked as our own count
 * (/declaration#built).
 */
export default function HeroChoices({ reads }: { reads: { n: number; date: string } | null }) {
  const t = useT();
  const day = useDay();
  const locale = useIntlLocale();
  return (
    <div className="hero-pick hero-choices">
      <p className="hero-pick-q" id="hero-pick-q">
        {t(HOME.hero.start)}
      </p>
      {/* Outlined on the hero (globals.css .button-hero-outline), its arrow (lucide's, not the "→" glyph
          Archivo lacks) amber and nudging on hover. */}
      <div className="hero-pick-row">
        <Link href="/move" className="button button-hero-outline" aria-describedby="hero-pick-q" onClick={() => closeExampleNow()}>
          {t("See how it works")} <span className="arrow" aria-hidden="true">
            <ArrowRightIcon size={18} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </Link>
      </div>
      {reads && (
        <p className="hero-pick-hint">
          {t.rich(
            HOME.hero.reads,
            {
              a: (c) => (
                <Link href="/declaration#built" className="hero-count-link">
                  {c}
                </Link>
              ),
            },
            { n: reads.n.toLocaleString(locale), date: day(reads.date) },
          )}
        </p>
      )}
    </div>
  );
}
