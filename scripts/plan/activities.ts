// Experience a student can build while studying, for the timeline planner (/plan): online
// internships, awards and societies from partner universities, remote-internship platforms, and
// MOM's rule on Student's Pass holders working. Each university or MOM entry quotes its official
// page, checked word for word before it is kept (pages read politely, through the browser where a
// site rejects scripted clients). Platforms are links only.
// Writes data/raw/plan-activities.json. Usage: npx tsx scripts/plan/activities.ts

import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";
import { readJson, today, writeJson } from "../pipeline/util";

const OUT = "data/raw/plan-activities.json";

export type Activity = {
  id: string;
  kind: "online-internship" | "award" | "society" | "platform";
  /** Online, or in person in Singapore (suggested only to students allowed to work: see lib/plan-timeline.ts). */
  mode: "online" | "in-person";
  title: string;
  /** A few words for the timeline. */
  short: string;
  /** Partner universities whose students it is for; empty means anyone. */
  universities: string[];
  /** YYYY-MM-DD dates, when the page gives them. */
  applyFrom: string | null;
  applyBy: string | null;
  start: string | null;
  end: string | null;
  note: string | null;
  /** A platform's label in the plan's list, its note folded in ("Forage (free, self-paced)"). */
  link?: string;
  url: string;
  quotes: string[];
  /** The page the quotes are on, when it is not `url` (a platform's FAQ). */
  quotesUrl?: string;
  /** When the quotes on `quotesUrl` were last checked word for word. */
  checked?: string;
};

const ACTIVITIES: Activity[] = [
  {
    id: "u21-sustainable-micro-internships",
    kind: "online-internship",
    mode: "online",
    title: "U21 Sustainable Micro-internships",
    short: "U21 online micro-internship",
    universities: ["University College Dublin"],
    applyFrom: "2026-10-12",
    applyBy: "2026-11-02",
    start: "2026-11-30",
    end: "2026-12-11",
    note: "Two weeks online with an organisation working on the UN Sustainable Development Goals. UCD students apply through UCD; ask UCD Global or Kaplan whether places are open to UCD students in Singapore.",
    url: "https://universitas21.com/opportunities/for-students/sustainable-internships/",
    quotes: [
      "Applications for U21 Sustainable Micro Internships will open on 12 October 2026 and will close on 2 November 2026",
      "The U21 Sustainable Micro-Internships are a 2-week online programme",
      "Any registered student (undergraduate or postgraduate) at a U21 member university",
      "students from the following universities should apply directly to their own universities",
      "Monday 30 November – Friday 11 December 2026",
    ],
  },
  {
    id: "ucd-advantage-award",
    kind: "award",
    mode: "online",
    title: "UCD Advantage Award",
    short: "UCD Advantage Award",
    universities: ["University College Dublin"],
    applyFrom: null,
    applyBy: null,
    start: null,
    end: null,
    note: "Do 2+ activities, one of them at UCD (a society or Student Ambassadors). It’s recorded on your UCD Diploma Supplement. Ask Kaplan which run in Singapore.",
    url: "https://www.ucd.ie/careers/advantage/",
    quotes: [
      "The UCD Advantage Award is open to all UCD students.",
      "Engage in a minimum of 2 co-curricular activities, one of which should be a UCD activity.",
      "The award is formally recorded on your UCD Diploma Supplement",
      "UCD Societies & Clubs",
      "UCD Student Ambassador Programme",
    ],
  },
  {
    id: "shixiseng",
    kind: "platform",
    mode: "online",
    title: "Shixiseng (实习僧)",
    short: "Remote internships: Shixiseng",
    universities: [],
    applyFrom: null,
    applyBy: null,
    start: null,
    end: null,
    note: "Internship listings in China, including remote ones; filter for remote work.",
    link: "Shixiseng (filter: remote)",
    url: "https://www.shixiseng.com/",
    quotes: [],
  },
  {
    id: "forage",
    kind: "platform",
    mode: "online",
    title: "Forage virtual job simulations",
    short: "Virtual job simulations: Forage",
    universities: [],
    applyFrom: null,
    applyBy: null,
    start: null,
    end: null,
    note: "Free, self-paced online tasks set by employers.",
    link: "Forage (free, self-paced)",
    url: "https://www.theforage.com/",
    quotes: [],
  },
  {
    id: "virtual-internships",
    kind: "platform",
    mode: "online",
    title: "Virtual Internships",
    short: "Remote placements: Virtual Internships",
    universities: [],
    applyFrom: null,
    applyBy: null,
    start: null,
    end: null,
    note: "Remote internship placements with companies abroad. Applying directly costs a programme fee, paid in two parts: an acceptance fee to start matching, then a final fee once you accept a placement.",
    link: "Virtual Internships (a fee for direct applicants)",
    url: "https://www.virtualinternships.com/",
    quotes: [
      "Individuals that apply to our program directly (not through a university or global partner) do pay a fee for the program.",
      "The fee is broken down into two parts: the acceptance fee which is paid in order to begin the internship matching process, and the final fee which is paid when the intern has accepted their internship placement.",
    ],
    quotesUrl: "https://www.virtualinternships.com/interns/faqs",
  },
  {
    id: "linkedin-remote",
    kind: "platform",
    mode: "online",
    title: "LinkedIn Jobs",
    short: "LinkedIn: remote internships",
    universities: [],
    applyFrom: null,
    applyBy: null,
    start: null,
    end: null,
    note: "Search for internships and filter by Remote.",
    link: "LinkedIn Jobs (filter: Remote)",
    url: "https://www.linkedin.com/jobs/",
    quotes: [],
  },
  {
    id: "internsg",
    kind: "platform",
    mode: "in-person",
    title: "InternSG",
    short: "Singapore internships: InternSG",
    universities: [],
    applyFrom: null,
    applyBy: null,
    start: null,
    end: null,
    note: "Internship listings in Singapore.",
    url: "https://www.internsg.com/",
    quotes: [],
  },
];

/** MOM's rule, quoted: who may work on a Student's Pass. */
const MOM = {
  url: "https://www.mom.gov.sg/passes-and-permits/work-pass-exemption-for-foreign-students",
  quotes: [
    "If you are holding a Student's Pass in Singapore issued by ICA, you are only allowed to work if you meet specific requirements.",
    "You can work during your vacation without a work pass if you meet all of the following criteria:",
    "Once you have completed your studies and your Student's Pass expires, you will need to get a work pass to work in Singapore.",
  ],
};

/** Private institutions whose absence from MOM's list is checked: CSCSE's list, plus Amity. */
function institutions(): string[] {
  const cscse = readJson<{ rows: { institution: string }[] }>("data/raw/cscse-sg-2026-09.json", { rows: [] });
  return [...new Set([...cscse.rows.map((r) => r.institution), "Amity Global Institute"])];
}

const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

async function text(url: string) {
  const r = await politeFetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.reason} ${r.detail}`);
  return squash(pageText({ url: r.finalUrl, html: r.body.toString("utf8") }).lines.join("\n"));
}

async function main() {
  routeThroughBrowser(["https://www.ucd.ie"]);
  const kept: Activity[] = [];
  const dropped: { id: string; missing: string[] }[] = [];
  for (const a of ACTIVITIES) {
    if (!a.quotes.length) {
      kept.push(a);
      continue;
    }
    const page = await text(a.quotesUrl ?? a.url);
    const missing = a.quotes.filter((q) => !page.includes(squash(q)));
    if (missing.length) dropped.push({ id: a.id, missing });
    else kept.push(a.quotesUrl ? { ...a, checked: today() } : a);
  }
  const mom = await text(MOM.url);
  const momMissing = MOM.quotes.filter((q) => !mom.includes(squash(q)));
  const notListed = institutions().filter((n) => !mom.includes(squash(n)));
  await closeBrowser();
  writeJson(OUT, {
    note: "Experience for the timeline planner; university and MOM quotes checked word for word against their pages.",
    builtAt: today(),
    activities: kept,
    mom: { url: MOM.url, quotes: momMissing.length ? [] : MOM.quotes, notOnExemptList: notListed, checked: today() },
    dropped: momMissing.length ? [...dropped, { id: "mom", missing: momMissing }] : dropped,
  });
  console.log(`${kept.length} activities kept, dropped:`, dropped, "· MOM missing:", momMissing, "· not on MOM list:", notListed);
}

main();
