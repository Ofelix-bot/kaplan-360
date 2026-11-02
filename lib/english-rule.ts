import type { EnglishRule, ResultsProgramme } from "@/lib/results-types";

// Whether a programme waives its English test for this site's students: Kaplan (and other Singapore private-school)
// graduates, whose degrees are taught in English, studied in Singapore and awarded by a partner university (UK,
// Australia, Ireland). A waiver's wording decides:
// - "a UK degree" (some name transnational degrees taught outside the UK): yes for a degree a UK university awards;
// - degrees from listed countries, or "a majority English-speaking country" (the UK list leaves Singapore out): yes
//   when Singapore is listed; "maybe" when only the awarding university's country is, since the degree was studied
//   here and the university decides whether that counts;
// - a degree taught in English, with no country named: yes.

/** UKVI's majority English-speaking countries (the list UK universities mean), with the UK itself. */
const MAJORITY = ["United Kingdom", "Australia", "Ireland", "New Zealand", "Canada", "United States", "Malta", "Antigua and Barbuda", "Bahamas", "Barbados", "Belize", "Dominica", "Grenada", "Guyana", "Jamaica", "St Kitts and Nevis", "St Lucia", "St Vincent and the Grenadines", "Trinidad and Tobago"];
const UK_DEGREE = /\bUK (degree|bachelor|honours|university|institution|higher education)|degree (awarded |conferred )?(by|from) a UK\b|\bTNE\b|transnational/i;
const MAJORITY_WORDS = /majority[- ]English[- ]speaking/i;
const named = (list: string[], country: string) => list.some((c) => c.toLowerCase().includes(country.toLowerCase()) || (country === "United Kingdom" && /\b(UK|U\.K\.|Britain|England)\b/i.test(c)) || (country === "United States" && /\b(US|USA|U\.S\.)\b/.test(c)));

export type Waiver = "yes" | "maybe" | "no";

/** The waiver for a degree taught in English, studied in Singapore, awarded by a university in `awardedIn`. */
export function englishWaiver(r: EnglishRule | null, awardedIn: string | null): Waiver {
  if (!r || r.required !== "unless-exempt" || !r.exemption) return "no";
  const { quote, countries } = r.exemption;
  if (UK_DEGREE.test(quote) && awardedIn === "United Kingdom") return "yes";
  const list = countries.length ? countries : MAJORITY_WORDS.test(quote) ? MAJORITY : null;
  if (!list) return UK_DEGREE.test(quote) ? "no" : "yes";
  if (named(list, "Singapore")) return "yes";
  return awardedIn && named(list, awardedIn) ? "maybe" : "no";
}

/** A score is needed: no waiver that may apply, and a stated rule or any published minimum. */
export const needsScore = (p: Pick<ResultsProgramme, "englishRule" | "ielts" | "toefl" | "pte" | "duolingo">, awardedIn: string | null): boolean =>
  englishWaiver(p.englishRule, awardedIn) === "no" && (p.englishRule !== null || [p.ielts, p.toefl, p.pte, p.duolingo].some((x) => x !== null));
