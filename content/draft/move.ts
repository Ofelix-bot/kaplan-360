import { msg } from "@/lib/i18n/translate";

// DRAFT — edit here. The /move page (components/landing/move). Owned by phase C1.
// Every string goes through msg() from "@/lib/i18n/translate" so scripts/i18n/extract.mjs collects it.
// Every fact here restates a receipt in lib/home/receipts.ts (named beside it); no hedging words.

export const move = {
  /** The hero's line at the bottom right, under the amber dash. Also the page's description. */
  heroLine: msg("Why ReFly.X built Kaplan 360++, and how every option is verified."),
  /** The English page's line there (2026-11-02): two lines, broken after "works,". */
  heroLineEn: msg("How Kaplan 360++ works, and how every option is verified."),
  /** What each door says in its road's drawer, in CARDS.rows order (content/landing.en.ts). */
  doors: [
    // monash-entry, monash-intakes
    msg("A better-ranked school. Entry asks for a credit (60%) average, with intakes in February, July and November."),
    // ep-2027, compass-40 (M4: only what MOM's sentence says)
    msg("S$6,000 · EP minimum qualifying salary · MOM. An application needs 40 COMPASS points."),
    // murdoch
    msg("A different field. Murdoch’s conversion master’s turns away applicants who already hold an accounting major from an Australian university."),
    // hkbu-january
    msg("A different country, on a January start: HKBU’s master’s lists a January entry."),
    // cscse (M2: a person read the list and transcribed it)
    msg("Recognition back home comes from CSCSE’s list, which a person read and transcribed."),
    // acca-faq, cfa-policy; the internship rule is ours (D24)
    msg("ACCA awards at most nine exemptions; CFA Level I can be sat up to 23 months before you graduate. Our rule: 3+ months means an internship."),
  ],
};
