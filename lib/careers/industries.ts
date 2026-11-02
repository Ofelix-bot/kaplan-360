import type { IndustryMeta } from "./types";

// The 16 Skills Framework sectors linked to at least one Kaplan degree (Q23), from the careers map
// (scratchpad careers/data/map.json, built from the Skills Framework Dataset). A static list, so the Services
// menu and generateStaticParams never read the database. sortOrder follows the map: most linked degrees first.
// `sector` is the name as the Skills Framework publishes it; `short` is at most 30 characters.
// scripts/check-careers.ts checks that these ids match data/raw/careers-industries.json one for one.

export const INDUSTRIES: readonly IndustryMeta[] = [
  { id: "infocomm-technology", sector: "Infocomm Technology", short: "Infocomm Technology", sortOrder: 1 },
  { id: "financial-services", sector: "Financial Services", short: "Financial Services", sortOrder: 2 },
  { id: "media", sector: "Media", short: "Media", sortOrder: 3 },
  { id: "wholesale-trade", sector: "Wholesale Trade", short: "Wholesale Trade", sortOrder: 4 },
  { id: "retail", sector: "Retail", short: "Retail", sortOrder: 5 },
  { id: "human-resource", sector: "Human Resource", short: "Human Resource", sortOrder: 6 },
  { id: "accountancy", sector: "Accountancy", short: "Accountancy", sortOrder: 7 },
  { id: "social-service", sector: "Social Service", short: "Social Service", sortOrder: 8 },
  { id: "logistics", sector: "Logistics", short: "Logistics", sortOrder: 9 },
  { id: "early-childhood", sector: "Early Childhood", short: "Early Childhood", sortOrder: 10 },
  { id: "hotel-and-accommodation-services", sector: "Hotel and Accommodation Services", short: "Hotels and Accommodation", sortOrder: 11 },
  { id: "tourism", sector: "Tourism", short: "Tourism", sortOrder: 12 },
  { id: "built-environment", sector: "Built Environment", short: "Built Environment", sortOrder: 13 },
  { id: "healthcare", sector: "Healthcare", short: "Healthcare", sortOrder: 14 },
  { id: "intellectual-property", sector: "Intellectual Property", short: "Intellectual Property", sortOrder: 15 },
  { id: "legal-services", sector: "Legal Services", short: "Legal Services", sortOrder: 16 },
];

const BY_ID = new Map(INDUSTRIES.map((i) => [i.id, i]));

/** The industry with this id, or null. */
export const industryById = (id: string): IndustryMeta | null => BY_ID.get(id) ?? null;

/** Whether `id` is one of the 16. */
export const isIndustryId = (id: string): boolean => BY_ID.has(id);

/**
 * An industry's name in the page's language: Chinese pages use the Services menu's wording, keyed
 * "<short> (menu)" (components/SiteHeader.tsx); English pages, and a name with no such entry, show `short`.
 */
export function industryName(t: (key: string) => string, short: string): string {
  const key = `${short} (menu)`;
  const out = t(key);
  return out === key ? short : out;
}

// Soft hyphens (U+00AD) in the long words of the names above. A title-case word is never hyphenated by
// Chromium's hyphens: auto, so in a narrow card "Accommodation" broke mid-word with no hyphen.
const BREAKS: Record<string, string> = {
  Technology: "Tech­nol­ogy",
  Financial: "Fi­nan­cial",
  Wholesale: "Whole­sale",
  Accountancy: "Ac­count­an­cy",
  Logistics: "Lo­gis­tics",
  Childhood: "Child­hood",
  Accommodation: "Ac­com­mo­da­tion",
  Environment: "En­vi­ron­ment",
  Healthcare: "Health­care",
  Intellectual: "In­tel­lec­tu­al",
};

/** An industry name with soft hyphens in its long words, for card titles (the text reads the same). */
export const breakable = (name: string): string => name.replace(/[A-Za-z]+/g, (w) => BREAKS[w] ?? w);
