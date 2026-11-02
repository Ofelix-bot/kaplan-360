// Which collected benefits the site shows (scripts/data/load-supabase.mjs sets the column from this;
// scripts/changes/diff.ts reports changes only for these).

// A title naming another country, region or group ("China Postgraduate Excellence Scholarships",
// refugee awards), or a national sponsor whose students alone get the discount (Chile's ANID, Mexico's
// CONAHCYT, FUNED and FIDERH, GuateFuturo). Commonwealth Master's Scholarships are for low- and
// middle-income member countries, which do not include Singapore.
export const TITLE_LIMITS =
  /refugee|asylum|sanctuary|commonwealth|\b(china|chinese|india|indian|africa|african|mexic\w*|canad\w*|german\w*|nigeria\w*|pakistan\w*|vietnam\w*|indonesia\w*|malaysia\w*|thai\w*|latin america\w*|caribbean|middle east\w*|arab\w*|turk\w*|kenya\w*|ghana\w*|egypt\w*|brazil\w*|chile\w*|colombia\w*|bangladesh\w*|nepal\w*|sri lanka\w*|philippin\w*|japan\w*|korea\w*|taiwan\w*|hong kong|american?|usa|eu|european|uk|home|kazakh\w*|uzbek\w*|central asia\w*|gulf|emirat\w*|saudi\w*|ukrain\w*|guatemal\w*|peru\w*|ecuador\w*|argentin\w*|anid|conahcyt|funed|fiderh|guatefuturo|colfuturo)\b/i;

/**
 * Not shown: staff-only discounts; awards whose own wording limits them to other nationalities or
 * groups (in the quotes, or in the title, e.g. refugee scholarships); UK/home-student awards;
 * foundation-year awards; research-degree-only items.
 */
export function shownBenefit(b) {
  return (
    !/\bstaff\b/i.test(b.title) &&
    b.openToSingapore !== false &&
    !TITLE_LIMITS.test(b.title) &&
    !/\buk\/home\b|\bhome students?\b/i.test(b.quotes?.international ?? "") &&
    !/\bfoundation year\b|\bIFY\b/.test(`${b.title} ${b.eligibility ?? ""} ${Object.values(b.quotes ?? {}).join(" ")}`) &&
    !/\bMRes\b|research training program|\b(about|by) research\b/i.test(b.title) &&
    // A bare heading ("Closing date", "Scholarship Applications") says nothing on its own.
    !/^(closing date|closing dates|bursaries close|scholarship applications|course applications|how to apply|deadlines?|key dates|important dates)$/i.test(b.title.trim()) &&
    // Undergraduate entry or Australian-resident awards (ATAR, school leavers, regional and remote students).
    !/\b(atar|school leavers?|year 12|regional and remote)\b/i.test(`${b.title} ${b.eligibility ?? ""} ${Object.values(b.quotes ?? {}).join(" ")}`) &&
    !/\bpgr\b/i.test(`${b.title} ${b.format ?? ""} ${b.eligibility ?? ""}`) &&
    !(/\b(phd|doctoral|doctorate|research degree|mphil|postgraduate research|research (scholarship|placement))\b/i.test(`${b.title} ${b.format ?? ""} ${b.eligibility ?? ""}`) &&
    !/master|\bmsc\b|\bma\b|\bmba\b|taught/i.test(`${b.title} ${b.format ?? ""} ${b.eligibility ?? ""} ${b.intake ?? ""}`))
  );
}
