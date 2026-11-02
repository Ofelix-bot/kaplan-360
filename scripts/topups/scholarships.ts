// Scholarships for Kaplan's partner bachelor's degrees, beyond the education grants each programme
// page lists (those are read by collect.ts). Each entry quotes its official page or the Degree
// Enrolment Day deck; web quotes are checked word for word against the page before they are kept.
// Writes data/raw/topup-scholarships.json. Usage: npx tsx scripts/topups/scholarships.ts

import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch } from "../pipeline/http";
import { readJson, today, writeJson } from "../pipeline/util";

const OUT = "data/raw/topup-scholarships.json";

export type TopupScholarship = {
  id: string;
  provider: string;
  /** Partner university it is limited to; null for all of the provider's degrees. */
  university: string | null;
  title: string;
  /** A few words for the card: who gives it and how much. */
  short: string;
  value: string;
  places: string | null;
  categories: string[];
  eligibility: string[];
  /** Web page, or the deck with its page number. */
  source: { kind: "web"; url: string } | { kind: "deck"; page: number };
  quotes: string[];
};

const ENTRIES: TopupScholarship[] = [
  {
    id: "murdoch-singapore-scholarships",
    provider: "kaplan",
    university: "Murdoch University",
    title: "Murdoch University Singapore Scholarships",
    short: "Murdoch scholarship · 50% off",
    value: "50% off tuition fees",
    places: "20 scholarships",
    categories: ["Inclusive Education Scholarship", "Academic Merit Scholarship", "Leadership Scholarship"],
    eligibility: [
      "Apply for an eligible Murdoch University programme offered in Singapore",
      "Meet the admission requirements of the chosen programme",
      "Submit a complete scholarship application with supporting documents",
      "Demonstrate suitability for the selected scholarship category",
    ],
    source: { kind: "web", url: "https://www.kaplan.com.sg/university/murdoch-university/scholarships" },
    quotes: [
      "20 Murdoch Singapore Scholarships.",
      "50% Off Tuition Fees.",
      "Murdoch University, in partnership with Kaplan Higher Education Academy, is offering 20 scholarships for eligible students pursuing a Murdoch programme in Singapore.",
      "Inclusive Education Scholarship",
      "Academic Merit Scholarship",
      "Leadership Scholarship",
      "Apply for an eligible Murdoch University programme offered in Singapore",
      "Meet the admission requirements of the chosen programme",
      "Submit a complete scholarship application with supporting documents",
      "Demonstrate suitability for the selected scholarship category",
      "Meeting the eligibility requirements does not guarantee the award of a scholarship.",
    ],
  },
];

/** The deck's Kaplan scholarship (p. 84): top three students, set against degree fees. */
function deckScholarship(): TopupScholarship | null {
  const deck = readJson<{ scholarship?: { page: number; awards: { place: number; amount: number }[]; criteria: string[] } }>(
    "data/raw/kaplan-degree-enrolment-day-2026-03.json",
    {},
  );
  const s = deck.scholarship;
  if (!s) return null;
  return {
    id: "kaplan-progression-scholarship",
    provider: "kaplan",
    university: null,
    title: "Kaplan scholarship for continuing students",
    short: `Kaplan scholarship · up to S$${Math.max(...s.awards.map((a) => a.amount)).toLocaleString("en-SG")}`,
    value: s.awards.map((a) => `S$${a.amount.toLocaleString("en-SG")}`).join(" / ") + " for the top three, set against the degree’s fees",
    places: `${s.awards.length} awards`,
    categories: [],
    // English summaries of the deck's Chinese criteria (quoted verbatim in `quotes`).
    eligibility: [
      "At least 90% attendance in every module",
      "Pass every exam at the first attempt",
      "An average of 85 or more across modules",
      "Continue from a Kaplan diploma to a partner university’s bachelor’s degree (or from the bachelor’s to its master’s)",
      "First instalment of fees paid",
    ],
    source: { kind: "deck", page: s.page },
    quotes: s.criteria,
  };
}

const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

async function main() {
  const kept: TopupScholarship[] = [];
  const dropped: { id: string; missing: string[] }[] = [];
  for (const e of ENTRIES) {
    if (e.source.kind !== "web") continue;
    const r = await politeFetch(e.source.url);
    if (!r.ok) {
      dropped.push({ id: e.id, missing: [`${r.reason} ${r.detail}`] });
      continue;
    }
    const text = squash(pageText({ url: r.finalUrl, html: r.body.toString("utf8") }).lines.join("\n"));
    const missing = e.quotes.filter((q) => !text.includes(squash(q)));
    if (missing.length) dropped.push({ id: e.id, missing });
    else kept.push(e);
  }
  const deck = deckScholarship();
  if (deck) kept.push(deck);
  await closeBrowser();
  writeJson(OUT, { note: "Scholarships for Kaplan partner degrees; web quotes checked against their pages.", builtAt: today(), items: kept, dropped });
  console.log(`${kept.length} kept, ${dropped.length} dropped`, dropped);
}

main();
