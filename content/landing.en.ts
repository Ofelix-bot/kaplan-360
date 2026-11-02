import { msg } from "@/lib/i18n/translate";

// The homepage's opening (components/landing), word for word as agreed. Every string is a translation
// key (lib/i18n: keys are the English text), so the Chinese pages show these in English until
// scripts/i18n/zh-hans has them. Typographic apostrophes and quotes are part of the copy.

/**
 * The apps the chat cards are styled after (look only: no logos, no names of the apps or of any school);
 * "mrt" is an ad in a train carriage; "kaplan" is in the brand colour, the only one that doesn't ask.
 */
export type App = "wechat" | "linkedin" | "whatsapp" | "xhs" | "mrt" | "kaplan";

/**
 * One note in the social feed (the "xhs" card): its title as posted, and one visible comment under it.
 * The titles are content, not interface copy: Chinese on every page, never translated.
 */
export type FeedNote = { title: string; comment?: string };

/** One card: who sends it, where, and the app's own small print. Times are shown as typed. */
export type Chat =
  | { app: "wechat"; sender: string; call: string; duration: string; time: string; message: string }
  | { app: "linkedin"; sender: string; headline: string; degree: string; time: string; message: string }
  | { app: "whatsapp"; sender: string; status: string; time: string; message: string }
  | { app: "xhs"; label: string; notes: FeedNote[] }
  | { app: "mrt"; label: string; ad: string }
  | { app: "kaplan"; sender: string; time: string; message: string };

/**
 * The chat cards. /move shows Mum (The problem: where the first push comes from) and the MRT ad, the
 * agent and the feed (What they go on). The homepage's thinking tile reads its senders (Mum, the agent,
 * the recruiter) and our own reply from here too, so the recruiter and Kaplan 360++ stay, unused on /move.
 */
export const OPENER = {
  chats: [
    { app: "wechat", sender: msg("Mum"), call: msg("Video call"), duration: "32:14", time: "21:48", message: msg("Have you decided about the master’s yet? Your dad keeps asking.") },
    { app: "linkedin", sender: "Daniel Koh", headline: msg("Graduate Recruiter"), degree: msg("1st"), time: "4:30 PM", message: msg("Great chat today. An 8-month top-up? Tell me what you can do beyond it.") },
    { app: "mrt", label: msg("An example ad in a train carriage"), ad: msg("Get your degree in 12 months!") },
    { app: "whatsapp", sender: msg("Kelvin (Agent)"), status: msg("online"), time: "10:41", message: msg("Easy to get in, done in a year, top partner unis. A real springboard! Feb intake closing 🔥") },
    {
      app: "xhs",
      label: msg("Example posts from a social feed, as the team saw them"),
      // A word joiner (U+2060) keeps "扣1" on one line.
      notes: [
        { title: "私校申请包过｜两周拿 offer" },
        { title: "全套课件 + 往年真题 出，小偿" },
        { title: "挂科了？一对一补考辅导" },
        { title: "论文代写 加急可做" },
        { title: "期末重点整理好啦，需要的扣⁠1", comment: "私" },
      ],
    },
    { app: "kaplan", sender: "Kaplan 360++", time: msg("now"), message: msg("Don’t answer yet. Look first.") },
  ] satisfies Chat[],
};

/** The card of one app (the first one, where an app has several). */
export const chatOf = <A extends App>(app: A) => OPENER.chats.find((c) => c.app === app) as Extract<Chat, { app: A }>;

/** 01 · Break it down: after graduation the roads split into three (Split.tsx, PathsA.tsx ThreeRoads). */
export const LOOK = {
  step: "01",
  title: msg("Break it down"),
  body: msg("After graduation: work, further study, or a gap year."),
  /** The picture's start (under its dot), its three ends, top to bottom, and what it shows for screen readers. */
  start: msg("Graduation"),
  roads: [msg("Work"), msg("Study"), msg("Gap")],
  figure: msg("From graduation, one road branching into three: work, study and a gap"),
};

/** The kinds of door a card can be. */
export type Door = "school" | "field" | "region" | "work" | "breathe";

/**
 * The six doors, the ones that keep the most doors open first. On /move they sit in the drawer of their
 * road (school, field and region in Study; work in Work; breathe in Gap: DOOR_ROAD in
 * components/landing/distance/CardsB.tsx). Every fact on a door comes from its receipts
 * (lib/home/receipts.ts); `check` is a part with no receipt yet, shown as "Still to check". The homepage's
 * doors tile names them from `kind`.
 */
export const CARDS = {
  rows: [
    { door: "school", kind: msg("Master’s · school ↑"), name: msg("Monash · Banking & Finance"), receipts: ["monash-entry", "monash-fee", "monash-intakes"] },
    { door: "work", kind: msg("Work first · Singapore"), name: msg("An EP that clears the salary floor + 40 COMPASS points"), tag: msg("Pay now, study later"), receipts: ["ep-2027", "compass-40"] },
    { door: "field", kind: msg("Master’s · field ↔"), name: msg("Murdoch · Accounting (conversion)"), receipts: ["murdoch"] },
    { door: "region", kind: msg("Master’s · region →"), name: msg("HKBU · January intake"), receipts: ["hkbu-january"] },
    { door: "work", kind: msg("Work first · back home"), name: msg("Recognition: CSCSE’s Singapore list"), check: msg("Campus-hire windows"), receipts: ["cscse"] },
    { door: "breathe", kind: msg("A year to breathe"), name: msg("Internship, a cert (ACCA / CFA Level 1) or an exchange"), tag: msg("Keeps every door open"), receipts: [] },
  ] satisfies { door: Door; kind: string; name: string; tag?: string; check?: string; receipts: string[] }[],
  /** A part with no receipt yet. */
  toCheck: msg("Still to check"),
  /** How a part and its state are joined. */
  part: msg("{label}: {state}"),
};

export type CheckState = "holds" | "check" | "out";

/** One step of the line in 02: what it is, its value, one line on it, and its receipts or "our count". */
/** `quote`: the official wording under the value, verbatim and never translated; `source`: a link to where it is. */
export type CheckStep = { label: string; value: string; detail: string; receipts: string[]; ours?: boolean; quote?: string; source?: { label: string; href: string } };

/**
 * 02 · Bring it together: our worked example's line, career first. Arjun (lib/personas.ts, UCD Finance
 * top-up) in Financial Services as an Investment Analyst (role investment-analyst, the user's pick on
 * 2026-10-30): his match (Medium, 4 of the 17 skills SWDA lists for it; 3 of 8 key skills before 2026-11-02), a key skill he misses that no Kaplan degree's core
 * modules cover and that the master's adds (Climate Change Management), and the role page's first
 * master's pick (lib/careers/masters.ts pickMasters slot 1, chosen for that skill). Worked out from
 * data/raw/careers-*.json and master-skills.json on 2026-10-30 with lib/careers/match.ts; the counts
 * are ours, the rank has its receipt.
 */
export const CHECK = {
  step: "02",
  title: msg("Bring it together"),
  /** The line under the heading, as 01's. */
  body: msg("From your degree to the role you want, and what fills the gap."),
  /** The picture beside the heading: every road there is, narrowing to the one that holds. */
  figure: msg("Six roads narrowing to one; two fade out on the way"),
  who: msg("Arjun · UCD Finance top-up"),
  /** The list beside the panel, for screen readers. */
  steps: msg("Arjun’s line, from the industry to the master’s"),
  line: [
    { label: msg("Industry"), value: msg("Financial Services"), detail: msg("His UCD Finance degree leads straight into this industry."), receipts: [], ours: true },
    { label: msg("Role"), value: msg("Investment Analyst"), detail: msg("A Financial Services role. He covers 4 of the 17 skills SWDA lists for it."), receipts: [], ours: true },
    {
      label: msg("Missing skill"),
      value: msg("Climate Change Management"),
      detail: msg("No Kaplan degree’s core modules cover it."),
      receipts: [],
      ours: true,
      // IBF's own description of the skill, the first sentence as published (read 2026-11-01). The
      // Sustainable Finance TSCs are IBF's supplement to the Financial Services Skills Framework.
      quote: "Synthesise information on climate change and climate policy developments to shape the organisation's strategies and policies, products and/or services",
      source: { label: "IBF Sustainable Finance TSCs", href: "https://www.ibf.org.sg/home/for-individuals/resource-tools/sustainable-finance-technical-skills-and-competencies" },
    },
    { label: msg("Master’s"), value: msg("Bristol · MSc Management (Sustainability)"), detail: msg("Its learning outcomes add it, with Ethical Culture. QS 2027: #57."), receipts: ["qs-2027-bristol"] },
  ] satisfies CheckStep[],
  /** Read before the receipt icon on a step, for screen readers. */
  receipt: msg("Receipt"),
  /** Shown where a step rests on our own count. */
  ours: msg("Kaplan 360++ analysis"),
  states: { holds: msg("Checks out"), check: msg("Still to check"), out: msg("Crossed out") } satisfies Record<CheckState, string>,
};

/** 03 · Lay it out: the map and the timeline, then the two ways on. */
export const CLOSING = {
  step: "03",
  title: msg("Lay it out"),
};

/** The hero, after the story: its trajectory, the question, the two ways in, and how many pages were read. */
export const HERO = {
  stops: [msg("Look"), msg("Check"), msg("Decide")],
  route: msg("Your route: look first, check the rules, then decide."),
  question: msg("Where do you stand?"),
  /** To /next-steps. Each way in is "who → where it starts"; the arrow is drawn between the two parts. */
  unsure: { who: msg("No plan yet"), go: msg("start at 01 · Look") },
  /** To /results with the sentence box open, for the idea. */
  idea: { who: msg("I have an idea"), go: msg("skip to 02 · Check") },
  /** {n} is the pages the last refresh read (lib/changes.ts). */
  pages: msg("{n} official pages · Every number has a source"),
};
