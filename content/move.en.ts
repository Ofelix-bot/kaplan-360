import { msg } from "@/lib/i18n/translate";

// /move, "Insights" (components/landing/move): the page's own English copy, including the three screens
// between the line under the hero and 01 (Who it's for, The problem, What they go on) and the closing band. Every string is a
// translation key (lib/i18n: keys are the English text). The sections it shares with the old homepage
// (the chats, 01 Break it down, 02 Bring it together, 03 Lay it out) keep their words in
// content/landing.en.ts; the roads' in content/roads.en.ts; the lines still being drafted live in
// content/draft/move.ts. The slogan "360° clarity. One defining leap." is never a message: it stays
// English on every page (components/landing/move/MoveHero.tsx).

/** The sticky band under the header: the page's name, then one link per section (steps numbered). The three
 *  roads are 01's sub-sections, in a row under it. */
export const BAND = {
  label: msg("Insights"),
  items: [
    // "Why" is the first of the three screens before 01 (Who it's for).
    { id: "why", label: msg("Why") },
    {
      id: "look",
      label: msg("Break it down"),
      step: "01",
      children: [
        { id: "work", label: msg("Work") },
        { id: "study", label: msg("Study") },
        { id: "gap", label: msg("Gap") },
      ],
    },
    { id: "check", label: msg("Bring it together"), step: "02" },
    { id: "decide", label: msg("Lay it out"), step: "03" },
    // The section keeps its id (#receipts): the homepage links to it.
    { id: "receipts", label: msg("Sources") },
  ] satisfies { id: string; label: string; step?: string; children?: { id: string; label: string }[] }[],
};

/** The one line directly under the hero. Kaplan360 is Kaplan's own app (no space); the space inside
 *  "Kaplan 360++" is a no-break space (U+00A0), so the name never splits across lines. */
export const PATCH = {
  line: msg("Kaplan360 is for your studies. Kaplan 360++ is for what comes next."),
};

/** Screen 1, #why: Kaplan's graduates in Singapore, cumulative, as three bars (MoveScreens.tsx Climb). */
export const WHO = {
  /** {n}: the last bar's count, formatted (the same receipt as the bar). <big> is the figure, set large in
   *  the bar's indigo; the words around it are a smaller line (MoveScreens.tsx WhoSection). */
  title: msg("<big>{n}+</big> Kaplan graduates, and counting."),
  /** In page order, each with the year of its receipt under it. The receipts' wording stays as published
   *  (100,000: "crossed the 100,000 graduates mark"); the face shows every count with "+". */
  bars: [
    { value: "85,000+", n: 85000, year: "2022", receipts: ["kaplan-grads-85k"] },
    { value: "100,000+", n: 100000, year: "2023", receipts: ["kaplan-grads-100k"] },
    { value: "114,000+", n: 114000, year: "2025", receipts: ["kaplan-grads-114k"] },
  ],
  caption: msg("Kaplan diploma and degree graduates in Singapore, cumulative"),
  /** The visible line under the chart. */
  axis: msg("Kaplan graduates in Singapore, cumulative"),
  /** For screen readers: the chart as one sentence ({y1}…{v3}: each bar's year and count). */
  figure: msg("Kaplan graduates in Singapore, cumulative: {y1}, {v1}; {y2}, {v2}; {y3}, {v3}"),
  /** The info tip beside the chart's receipt chip, which holds the caption. */
  about: msg("About these numbers"),
};

/**
 * Screen 2, #problem: a student leaves campus for the office towers and stops where the path is
 * unfinished (MoveScreens.tsx ProblemArt, components/landing/roads/scenes/problem.ts). The nudges are
 * graphic only; the tags over the picture are one or two words each.
 */
export const PROBLEM = {
  /** Two lines on desktop, broken after "decisions" (MoveScreens.tsx); "someone else’s" never parts
   *  (a no-break space, U+00A0). */
  title: msg("Nudged into decisions\nat someone else’s pace."),
  /** The tags on the picture's pins, in pin order: the campus, the towers, the gap. */
  tags: [msg("Study ✓"), msg("Job"), msg("?")],
  figure: msg("A student leaves campus heading for office towers; the path between is unfinished and the towers’ empty slots have nothing to fill them: nobody says what to prepare. A phone call and a flashing ad push them on to the edge of the gap."),
  body: msg("You know the plan: study, then get a job. But nobody tells you what to prepare in between, so someone else ends up setting the pace."),
};

/** Screen 3, #noise: what they go on, and the thesis behind it (MoveScreens.tsx Noise). */
export const NOISE = {
  title: msg("Lots of noise. Little signal."),
  /** The drawer beside the heading: the thesis lines, each with its receipt. */
  evidence: msg("Sources"),
  /** English pages only, under the feed card (its posts stay Chinese on every page): what the posts are. */
  feed: msg("Social posts selling guaranteed offers, past exam papers and essay ghostwriting."),
  source: msg("Dhaliwal (2022), Edinburgh Napier DBA thesis: nine former full-time PEI undergraduates, interviewed in 2020"),
  items: [
    { text: msg("‘Students were “pushed” to PEIs.’ Dhaliwal 2022, p.117, nine former PEI students"), receipts: ["dhaliwal-pushed"] },
    { text: msg("Most said the degree was their parents’ decision. p.93"), receipts: ["dhaliwal-parents"] },
    { text: msg("Many couldn’t recall where they first heard of their school. p.108"), receipts: ["dhaliwal-recall"] },
  ],
};

/** The closing band after 03, on the night ground: the page's one call to action. */
export const START = {
  title: msg("Start with you."),
  line: msg("Takes 2 minutes"),
  /** To /profile with the visitor's own answers (the worked example is closed first). */
  go: msg("Build your profile"),
  /** To /careers with our worked example (Arjun) opened first. */
  example: msg("or follow Arjun’s example"),
};

/** The drawers (components/landing/move/MoveDrawer.tsx): the trigger on each road, and the heading over its doors. */
export const DRAWER = {
  more: msg("Read more"),
  doors: msg("Doors on this road"),
};

/** 03 Lay it out. {date} is the day of the last full read (data/raw/changes.json). */
export const DECIDE = {
  /** In the info tip beside the heading (InfoTip): what the step gives you. */
  about: msg("What you get"),
  body: msg("A map of your roads. A month-by-month timeline: tests, applications, internships, Kaplan activities. Take it as a PDF or into your calendar."),
  /** In the info tip beside the pages figure. */
  sources: msg("About these numbers"),
  receipts: msg("Every number has a source. Nothing reaches you unless the page says it word for word."),
  /** Under the card's figure (every page and API read, lib/read-count.ts): {from} the first read, {to} the latest. */
  reads: msg("pages and API reads · {from} – {to}"),
  count: msg("Kaplan 360++’s own count"),
  /** The line under the heading, as 01's and 02's. */
  sub: msg("A month-by-month plan for your road: tests, applications, internships."),
  /** The "Coming next" drawer: what is planned, and not built yet. `soon`: the status tag beside its trigger. */
  next: {
    trigger: msg("See what’s planned"),
    soon: msg("Coming soon"),
    title: msg("Coming next"),
    planned: msg("Planned"),
    items: [
      { title: msg("CV wording help"), body: msg("Put your modules, projects and internships into the words a role asks for.") },
      { title: msg("Email updates"), body: msg("A note when a date or a rule on your timeline changes.") },
    ],
  },
};

/** #receipts: the ticker of official sentences, each with the day it was read. */
export const RECEIPTS_MOVE = {
  title: msg("Every fact has a source."),
  label: msg("Sources"),
  read: msg("Read {date}"),
  /** The ticker's receipts in order, each with the claim on the site it backs (under the source's name,
   *  over the quote): who or what the quote is about where the quote doesn't say. */
  items: [
    { id: "compass-40", claim: msg("Points an Employment Pass application needs") },
    { id: "c2-top100", claim: msg("Universities that earn 20 COMPASS points") },
    { id: "visit-89", claim: msg("How long you can stay after your Student’s Pass ends") },
    { id: "hkust-fina-entry", claim: msg("HKUST MSc in Finance entry requirement") },
    { id: "hkbu-january", claim: msg("HKBU MSc Entrepreneurship and Global Marketing: January start") },
    { id: "au-2025-salary", claim: msg("Fresh graduates’ median pay, university versus polytechnic, 2025") },
    { id: "kaplan-grads-100k", claim: msg("Kaplan Singapore’s total graduates, November 2023") },
    { id: "qs-2027-bristol", claim: msg("University of Bristol · QS World University Rankings 2027") },
    { id: "nus-mim-entry", claim: msg("NUS MSc in Management entry requirement") },
    { id: "cscse-list-nus", claim: msg("NUS on CSCSE’s list of recognised institutions") },
    { id: "immd-iang-eligibility", claim: msg("Who qualifies for Hong Kong’s IANG work visa") },
    { id: "dhaliwal-pushed", claim: msg("Why students end up at private institutions") },
  ],
};

/** The English page's band (2026-11-02 brief): one link per section, no road sub-links; Sources is the
 *  section after 03 (#sources), not the ticker (#receipts, which keeps its id for the homepage's link). */
export const BAND_EN = {
  label: msg("Insights"),
  items: [
    { id: "why", label: msg("Why") },
    { id: "look", label: msg("Break it down"), step: "01" },
    { id: "check", label: msg("Bring it together"), step: "02" },
    { id: "decide", label: msg("Lay it out"), step: "03" },
    { id: "sources", label: msg("Sources") },
  ],
};

/** The English page's intro under the band: PATCH.line in two lines, then "How it works" in four steps
 *  (components/landing/move/HowItWorks.tsx). Each step's `href` is where the step goes. */
export const HOW = {
  title: msg("How it works"),
  steps: [
    { label: msg("Takes 2 minutes"), title: msg("Start with you"), body: msg("Your degree, grades, budget and preferred countries."), link: msg("Build your profile") },
    { step: "01", title: msg("Break it down"), body: msg("Every road after graduation, checked against the official rules."), href: "#look" },
    { step: "02", title: msg("Bring it together"), body: msg("From your degree to the role you want, and what fills the gap."), href: "#check" },
    { step: "03", title: msg("Lay it out"), body: msg("A month-by-month plan for your road."), href: "#decide", soon: true },
  ],
};

/** The English page's Why: the problem screen with its eyebrow. */
export const WHY = { eyebrow: msg("Why") };

/** The English page's three roads: the text beside each road's art (RoadCard.tsx RoadChecks). */
export const ROAD_CHECKS = {
  title: msg("Kaplan 360++ checks"),
  soon: msg("Coming soon"),
  roads: {
    work: {
      line: msg("Start your career in Singapore or back home."),
      checks: [msg("Which industries and roles your degree leads to"), msg("What a work pass needs: salary floor and COMPASS points"), msg("Roles in demand in each industry")],
      soon: [] as number[],
      link: { label: msg("See where your degree leads"), href: "/careers" },
    },
    study: {
      line: msg("Go on to a master’s: a stronger school, a new field or a new country."),
      checks: [msg("Entry requirements, word for word from each university"), msg("How hard each programme is to get into"), msg("Fees, intakes and deadlines")],
      soon: [] as number[],
      link: { label: msg("Find programmes"), href: "/results" },
    },
    gap: {
      line: msg("Take time to build skills, sit tests or gain experience before you choose."),
      checks: [msg("How long you can stay after your Student’s Pass ends"), msg("Skills your target role needs that your degree doesn’t cover"), msg("Test and application dates for the next intake")],
      /** Indexes of checks not built yet: a clock instead of a tick, and "Coming soon". */
      soon: [2],
      link: { label: msg("See Arjun’s example"), href: "/results", example: "arjun" },
    },
  },
};

/** The English page's 03: the card beside the heading, what is planned. */
export const PLANNED = {
  title: msg("What’s planned"),
  items: [msg("A map of your roads"), msg("A timeline with tests, applications, internships and Kaplan activities"), msg("Take it as a PDF or into your calendar")],
};

/** The English page's Sources (#sources): the pages card from 03 and how a fact is checked, in four steps.
 *  {pages} and {api}: the pages read and the API calls made (lib/read-count.ts). */
export const SOURCES = {
  eyebrow: msg("Sources"),
  title: msg("How every fact is checked"),
  steps: [
    { title: msg("Read"), body: msg("We read {pages} pages from universities, employers, government agencies and applicant forums, and made {api} API calls.") },
    { title: msg("Pick out"), body: msg("Fees, entry requirements, deadlines and job openings.") },
    { title: msg("Match"), body: msg("Every value is matched word for word against the page it came from.") },
    { title: msg("Drop"), body: msg("Anything the page doesn’t say is dropped, not guessed.") },
  ],
};
