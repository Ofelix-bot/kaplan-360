// Universities the pipeline collects master's programmes from, by institution id
// (data/raw/institutions.json). Tier 1 first: Kaplan Singapore's partners, then Singapore, UK,
// Australia and Ireland. Each entry names official sites only; patterns checked 2026-10-18.
// `sitemaps`/`listings` override discovery through robots.txt; `include` narrows candidate URLs;
// `rewriteHost` maps a listing's link host to the site's canonical host.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ucdCatalogue from "./lists/university-college-dublin.json";
import phase1Include from "./lists/phase1-include.json";
import phase1 from "./lists/phase1-origins.json";
import { CATALOGUES } from "./asia-catalogue";

export type Source = {
  id: string;
  /** Official origins, e.g. "https://www.aston.ac.uk". */
  origins: string[];
  sitemaps?: string[];
  /** Course-listing pages whose links are candidates, for sites without a usable sitemap. */
  listings?: string[];
  /** Only URLs whose path matches this pattern are candidates. */
  include?: string;
  /** Extra path pattern to drop. */
  exclude?: string;
  rewriteHost?: Record<string, string>;
  /** The site rejects scripted HTTP clients: fetch through a real Edge window (browser.ts). */
  browser?: boolean;
  /** With `browser`: a list that pages by script; this selector is its "next" / "load more" control, clicked until done. */
  listingNext?: string;
  /** Programme pages listed explicitly, from a catalogue saved in scripts/pipeline/lists/ (sites whose lists load by script). */
  pages?: string[];
  /** Programme pages added to what discovery finds: pages its listing or `include` misses (checked by hand). */
  alsoPages?: string[];
  /** Course pages differ only by query string: keep it when normalising URLs. */
  keepQuery?: boolean;
  /** URLs carry course codes, not names: every URL matching `include` is a candidate. */
  codes?: boolean;
  /** Not collected automatically, with the reason (the programmes go to the manual queue). */
  skip?: string;
  /** University-wide English language requirements, for programmes whose page gives no IELTS score. */
  englishPage?: string;
};

const MURDOCH_AREAS = [
  "business", "creative-media-and-communication", "criminology", "education", "health-and-wellbeing",
  "information-technology", "law", "psychology", "allied-health", "nursing-and-midwifery",
  "humanities-arts-and-social-sciences", "sport-and-exercise",
].map((a) => `https://www.murdoch.edu.au/study/courses/study-areas/${a}`);

// Reading's postgraduate subject pages, as its home page lists them (2026-10-22).
const READING_SUBJECTS = [
  "accounting", "agriculture", "ancient-history", "archaeology", "architecture", "art", "artificial-intelligence", "biological-sciences", "biomedical-sciences",
  "business-post-experience", "business-pre-experience", "classics-and-ancient-history", "climate-science", "computer-science",
  "construction-management-and-engineering", "consumer-behaviour", "data-science", "dietetics", "digital-business", "ecology", "economics", "education",
  "energy-and-environmental-engineering", "engineering", "english-language-and-applied-linguistics", "english-literature", "environmental-science",
  "film-theatre-and-television", "finance", "food-and-nutritional-sciences", "geography-and-environmental-science", "graphic-design", "healthcare", "history",
  "information-technology", "international-development-and-applied-economics", "law", "linguistics", "management", "meteorology-and-climate", "microbiology",
  "nutritional-sciences", "pharmacy", "philosophy", "physician-associate", "politics-and-international-relations", "project-management", "psychology",
  "public-policy", "real-estate-and-planning", "social-policy", "speech-and-language-therapy", "strategic-studies", "teaching", "theatre",
  "typography-and-graphic-communication", "war-and-peace-studies", "zoology",
];

// Ulster's postgraduate subject pages (from its sitemap, 2026-10-22).
const ULSTER_SUBJECTS = [
  "accounting", "architecture-and-the-built-environment", "art-and-design", "biology-and-biomedical-sciences", "communication-and-media",
  "computing-and-computing-technologies", "education", "engineering", "geography-and-environmental-sciences", "heritage-culture-and-society",
  "hospitality-travel-and-tourism", "justice-and-human-rights", "law", "management-leadership-and-marketing", "medicine-and-health-sciences", "nursing",
  "pharmacy-and-pharmaceutical-sciences", "postgraduate-courses-in-psychology", "screen-and-storytelling", "sport-coaching-and-management",
];

const NOTTINGHAM_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  .split("")
  .map((l) => `https://www.nottingham.ac.uk/pgstudy/courses/courses.aspx?letter=${l}&year=2027&studytype=&level=all&search_keywords=`);


export const SOURCES: Source[] = [
  // Kaplan Singapore partners
  {
    id: "aston-university",
    origins: ["https://www.aston.ac.uk"],
    sitemaps: ["https://www.aston.ac.uk/sitemap.xml"],
    include: "^/study/courses/[a-z0-9-]+-(msc|ma|mba|llm|mpharm|march)(/(january|september)-20\\d\\d)?$",
    exclude: "mres|apprenticeship|online|distance",
    englishPage: "https://www.aston.ac.uk/international/english-language-requirements",
  },
  {
    id: "birmingham-city-university",
    origins: ["https://www.bcu.ac.uk"],
    include: "^/courses/[a-z0-9-]+-(msc|ma|mba|llm|mfa|med|mres)-2027-28$",
    exclude: "masters-stage|mres|top-up|distance|online|apprenticeship",
  },
  {
    id: "northumbria-university-at-newcastle",
    origins: ["https://www.northumbria.ac.uk"],
    include: "^/study-at-northumbria/courses/(msc|ma|mba|llm|master-of-[a-z]+|mres|med|mph|mlitt)-[a-z0-9-]+/?$",
    exclude: "mres|apprenticeship|distance-learning|online|-dl-|part-time",
  },
  {
    id: "university-of-portsmouth",
    origins: ["https://www.port.ac.uk"],
    include: "^/study/courses/postgraduate-taught/(msc|ma|mba|llm|med|mph|march|mres)-[a-z0-9-]+$",
    exclude: "mres|learning-at-work|apprenticeship|distance|online",
  },
  {
    id: "murdoch-university",
    origins: ["https://www.murdoch.edu.au"],
    listings: MURDOCH_AREAS,
    include: "^/course/postgraduate/m\\d{4}$", // m = master's; c/g = graduate certificates and diplomas
    rewriteHost: { "mu-website.azurewebsites.net": "www.murdoch.edu.au" },
    englishPage: "https://www.murdoch.edu.au/study/how-to-apply/entry-requirements/english-proficiency-tests",
  },
  // Monash (Crawl-delay 30 s) and UCD (browser only).
  { id: "monash-university", origins: ["https://www.monash.edu"], listings: ["https://www.monash.edu/study/courses/find-a-course"], include: "^/study/courses/find-a-course/[a-z0-9-]+-[a-z]6[0-9]{3}$", browser: true }, // 6xxx codes are master's; robots.txt Crawl-delay 30 s
  { id: "university-college-dublin", origins: ["https://hub.ucd.ie"], pages: ucdCatalogue.programmes.map((p) => p.url), keepQuery: true },

  // Starting points from the v1 demo config (origins and URL patterns only), each re-verified by discovery.
  // Singapore
  { id: "national-university-of-singapore", origins: ["https://study.nus.edu.sg"], skip: "programme catalogue renders cards without links and pages by script; faculty sites differ; manual queue" },
  { id: "nanyang-technological-university-singapore", origins: ["https://www.ntu.edu.sg"], listings: ["https://www.ntu.edu.sg/admissions/graduate/programme-listing?listingKeyword=&disciplines=all&programmelevels=all&programmetypes=all&page=1", "https://www.ntu.edu.sg/business/admissions/graduate-studies"], listingNext: "a[data-page]:has-text(\"Next\")", include: "^/education/graduate-programme/(master|msc)|^/business/admissions/graduate-studies/(msc|master|mba|nanyang-mba)", browser: true },
  // United Kingdom
  { id: "imperial-college-london", origins: ["https://www.imperial.ac.uk"], include: "^/study/courses/postgraduate-taught/2027/[^/]+" },
  { id: "university-of-oxford", origins: ["https://www.ox.ac.uk"], include: "/admissions/graduate/courses/", browser: true },
  { id: "university-of-cambridge", origins: ["https://www.postgraduate.study.cam.ac.uk"] },
  { id: "ucl", origins: ["https://www.ucl.ac.uk"], include: "/prospective-students/graduate/taught-degrees/", browser: true },
  { id: "university-of-edinburgh", origins: ["https://study.ed.ac.uk"], listings: ["https://study.ed.ac.uk/programmes/postgraduate-taught-a-z"], include: "^/programmes/postgraduate-taught/[0-9]+-", browser: true },
  { id: "king-s-college-london", origins: ["https://www.kcl.ac.uk"], include: "/study/postgraduate-taught/courses/" },
  { id: "university-of-manchester", origins: ["https://www.manchester.ac.uk"], include: "/study/masters/courses/list/" },
  { id: "university-of-bristol", origins: ["https://www.bristol.ac.uk"], include: "/study/postgraduate/taught/" },
  { id: "london-school-of-economics-and-political-science", origins: ["https://www.lse.ac.uk"], listings: ["https://www.lse.ac.uk/study-at-lse/Graduate/Available-programmes"], include: "^/study-at-lse/graduate/(msc|mpa|mpp|llm|mba|ma|mfin|mres)-", alsoPages: ["https://www.lse.ac.uk/study-at-lse/graduate/masters-in-management"] },
  { id: "university-of-warwick", origins: ["https://warwick.ac.uk", "https://www.wbs.ac.uk"], listings: ["https://warwick.ac.uk/study/postgraduate/courses/"], listingNext: "#load-more", include: "^/study/postgraduate/courses/(msc|ma|mba|llm|mph|med|mfin|mpa)-|^/courses/masters/", browser: true },
  { id: "university-of-birmingham", origins: ["https://www.birmingham.ac.uk"], include: "/study/postgraduate/subjects/[a-z-]+/[a-z-]+-(msc|ma)$" },
  { id: "university-of-leeds", origins: ["https://courses.leeds.ac.uk"] },
  { id: "university-of-glasgow", origins: ["https://www.gla.ac.uk"], listings: ["https://www.gla.ac.uk/postgraduate/taught/"], include: "/postgraduate/taught/" },
  { id: "university-of-sheffield", origins: ["https://www.sheffield.ac.uk", "https://sheffield.ac.uk"], include: "/postgraduate/taught/courses/", browser: true },
  { id: "durham-university", origins: ["https://www.durham.ac.uk"], include: "^/study/courses/[a-z0-9-]+-[a-z][0-9][a-z][0-9]{3}(/september-20[0-9]{2})?$", browser: true, alsoPages: ["https://www.durham.ac.uk/business/courses/n2p109"] }, // postgraduate codes look like g5k823; undergraduate ones have four characters
  { id: "university-of-nottingham", origins: ["https://www.nottingham.ac.uk"], listings: NOTTINGHAM_LETTERS, include: "^/pgstudy/course/taught/", skip: "robots.txt disallows AI assistants (ChatGPT-User, Perplexity-User) site-wide; manual queue" },
  { id: "queen-mary-university-of-london", origins: ["https://www.qmul.ac.uk"], listings: ["https://www.qmul.ac.uk/postgraduate/taught/coursefinder/"], listingNext: "a.page-link-searchstudio-js:has-text(\"Next\")", include: "^/postgraduate/taught/coursefinder/courses/[a-z0-9-]+-(msc|ma|mba|llm|mph|med|mpa|mfin)$", browser: true },
  { id: "university-of-southampton", origins: ["https://www.southampton.ac.uk"], include: "/courses/.*-masters-msc|/courses/.*-msc|/courses/.*-ma" },
  { id: "university-of-st-andrews", origins: ["https://www.st-andrews.ac.uk"], include: "/subjects/.*/.*-msc|/subjects/.*/.*-mlitt|/subjects/.*/.*-ma" },
  { id: "university-of-bath", origins: ["https://www.bath.ac.uk"], include: "^/courses/postgraduate-2027/taught-postgraduate-courses/" },
  { id: "university-of-exeter", origins: ["https://www.exeter.ac.uk"], include: "^/masters-degrees/(msc|ma|mba|llm|mpa|mph|med|mfin|march|mres)-" },
  { id: "university-of-liverpool", origins: ["https://www.liverpool.ac.uk"], listings: ["https://www.liverpool.ac.uk/courses/postgraduate-taught"], include: "^/courses/[a-z0-9-]+-(msc|ma|mba|llm|mph|mpa|med|msc-eng|march|mfa|mres)$|^/courses/[a-z-]+-registered-nurse-status$", alsoPages: ["https://www.liverpool.ac.uk/courses/master-in-management-mim"] },
  { id: "newcastle-university", origins: ["https://www.ncl.ac.uk"], listings: ["https://www.ncl.ac.uk/postgraduate/degrees/"], include: "^/postgraduate/degrees/[0-9]{4}f$", codes: true }, // codes ending in f are full-time
  { id: "university-of-york", origins: ["https://www.york.ac.uk"], listings: ["https://www.york.ac.uk/study/postgraduate/courses/all?mode=taught"], include: "^/study/postgraduate-taught/courses/(msc|ma|mba|llm|mpa|mph|med|mres|march)-" },
  { id: "lancaster-university", origins: ["https://www.lancaster.ac.uk"], listings: ["https://www.lancaster.ac.uk/study/postgraduate/postgraduate-courses/"], include: "^/study/postgraduate/postgraduate-courses/[a-z0-9-]+-(msc|ma|mba|llm|mpa|mph|med|mres|march)(-[0-9]{4})?$", browser: true },
  { id: "queen-s-university-belfast", origins: ["https://www.qub.ac.uk"], include: "/courses/postgraduate-taught/", browser: true },
  { id: "cardiff-university", origins: ["https://www.cardiff.ac.uk"], listings: ["https://www.cardiff.ac.uk/study/postgraduate/taught/courses"], include: "^/study/postgraduate/taught/courses/course/", browser: true },
  // Added 2026-10-22 (their sitemaps don't name the degree in course URLs).
  // Ulster: the postgraduate subject pages should link the 2027/28 course pages, but they load their lists by
  // script and none come through yet, so it waits for the next round.
  // Its pages now come from the list configured on 2026-11-01 (lists/phase1/ulster-university.json).
  { id: "ulster-university", origins: ["https://www.ulster.ac.uk"], listings: ULSTER_SUBJECTS.map((s) => `https://www.ulster.ac.uk/study/postgraduate/courses/subjects/${s}`), include: "^/courses/202728/[a-z0-9-]+-\\d+$", browser: true },
  // Lincoln: course URLs are codes; master's codes end in "ms" or "ma" (research degrees "rp", undergraduate "ub").
  { id: "university-of-lincoln", origins: ["https://www.lincoln.ac.uk"], sitemaps: ["https://www.lincoln.ac.uk/sitemap-en.xml"], include: "^/course/[a-z0-9]{6}(ms|ma)$", codes: true },
  // Canberra: "/course/<code>/<version>/<year>", every level; the page names the award.
  { id: "university-of-canberra", origins: ["https://www.canberra.edu.au"], include: "^/course/[a-z0-9]+/\\d+/2027$", codes: true },
  { id: "london-school-of-hygiene-and-tropical-medicine", origins: ["https://www.lshtm.ac.uk"], listings: ["https://www.lshtm.ac.uk/study/courses/masters-degrees"], include: "^/study/courses/masters-degrees/[a-z0-9-]+$", browser: true },
  // Reading: no working sitemap; each postgraduate subject page links to its courses (2026-10-22).
  { id: "university-of-reading", origins: ["https://www.reading.ac.uk"], listings: READING_SUBJECTS.map((s) => `https://www.reading.ac.uk/ready-to-study/study/2026/${s}-pg`), include: "^/ready-to-study/study/subject-area/[a-z-]+-pg/(msc|ma|mba|llm|mph|med|mfin|mpa|mpp|march|mdes)-" },
  { id: "loughborough-university", origins: ["https://www.lboro.ac.uk", "https://lboro.ac.uk"], include: "/study/postgraduate/masters-degrees/" },
  { id: "university-of-strathclyde", origins: ["https://www.strath.ac.uk"], listings: ["https://www.strath.ac.uk/courses/postgraduatetaught/"], include: "/courses/postgraduatetaught/" },
  { id: "university-of-surrey", origins: ["https://www.surrey.ac.uk"], include: "/postgraduate/" },
  { id: "university-of-sussex", origins: ["https://www.sussex.ac.uk"], listings: ["https://www.sussex.ac.uk/study/masters/courses"], include: "/study/masters/courses/" },
  { id: "university-of-aberdeen", origins: ["https://www.abdn.ac.uk"], listings: ["https://www.abdn.ac.uk/study/postgraduate-taught/degree-programmes/?limit=All"], include: "^/study/postgraduate-taught/degree-programmes/[0-9]+/" },
  // Australia
  { id: "university-of-new-south-wales", origins: ["https://www.unsw.edu.au"], include: "/study/postgraduate/" },
  { id: "university-of-melbourne", origins: ["https://study.unimelb.edu.au"], include: "^/find/courses/graduate/master-of-", browser: true },
  { id: "university-of-sydney", origins: ["https://www.sydney.edu.au"], include: "/courses/courses/pc/", browser: true, alsoPages: ["https://www.sydney.edu.au/courses/courses/pc/master-of-commerce.html", "https://www.sydney.edu.au/courses/courses/pc/master-of-commerce-extension.html"] },
  // ANU: the catalogue lists ten postgraduate programs until "Show all results" is clicked; program URLs carry codes (2026-10-22).
  {
    id: "australian-national-university",
    origins: ["https://programsandcourses.anu.edu.au"],
    listings: ["https://programsandcourses.anu.edu.au/catalogue?FilterByPrograms=true&Source=Breadcrumb"],
    listingNext: '[data-filter="FilterByPostGraduate"] a:has-text("Show all results")',
    include: "^/2027/program/[0-9a-z]+$",
    codes: true,
    browser: true,
  },
  { id: "university-of-queensland", origins: ["https://study.uq.edu.au"], include: "/study-options/programs/master" },
  // UWA and Curtin: no usable sitemap; their course search lists the master's ten at a time (2026-10-22).
  { id: "university-of-western-australia", origins: ["https://www.uwa.edu.au"], listings: ["https://www.uwa.edu.au/search?f.Tabs%7Ccourses=Courses&collection=uowa~sp-search&query=master"], listingNext: 'button._next[aria-disabled="false"]', include: "/study/courses/master-", browser: true },
  { id: "adelaide-university", origins: ["https://www.adelaide.edu.au", "https://adelaide.edu.au"], include: "/study/degrees/master-of-" },
  { id: "university-of-technology-sydney", origins: ["https://www.uts.edu.au"], include: "/courses/master-of-" },
  { id: "rmit-university", origins: ["https://www.rmit.edu.au"], include: "/study-with-us/levels-of-study/postgraduate-study/masters-by-coursework/" },
  { id: "macquarie-university", origins: ["https://www.mq.edu.au"], include: "/study/find-a-course/courses/master-", browser: true },
  { id: "curtin-university", origins: ["https://www.curtin.edu.au", "https://search.curtin.edu.au"], listings: ["https://search.curtin.edu.au/results/courses?search_text=&study_level=postgraduate&study_type=course"], listingNext: 'button[aria-label="Next page"]', include: "/study/offering/course-pg-master", browser: true },
  { id: "university-of-wollongong", origins: ["https://www.uow.edu.au"], include: "/study/courses/master-" },
  { id: "deakin-university", origins: ["https://www.deakin.edu.au"], include: "/course/master-", browser: true },
  { id: "griffith-university", origins: ["https://www.griffith.edu.au"], include: "/study/degrees/master-", browser: true },
  { id: "queensland-university-of-technology", origins: ["https://www.qut.edu.au"], include: "/courses/master-", browser: true },
  { id: "la-trobe-university", origins: ["https://www.latrobe.edu.au"], include: "/courses/master-", browser: true },
  { id: "university-of-newcastle-australia", origins: ["https://www.newcastle.edu.au"], include: "/degrees/master-", browser: true },
  { id: "swinburne-university-of-technology", origins: ["https://www.swinburne.edu.au"], include: "/course/postgraduate/master-" },
  // Ireland
  { id: "trinity-college-dublin-the-university-of-dublin", origins: ["https://www.tcd.ie"], listings: ["https://www.tcd.ie/courses/postgraduate/az/"], include: "/courses/postgraduate/", browser: true },
  { id: "university-college-cork", origins: ["https://www.ucc.ie"], include: "^/en/ck[a-z][0-9]{2,3}$", codes: true },
  { id: "national-university-of-ireland-galway", origins: ["https://www.universityofgalway.ie"], listings: ["https://www.universityofgalway.ie/courses/taught-postgraduate-courses/"], include: "/courses/taught-postgraduate-courses/" },

  // Built from scratch on 2026-10-18 from each site's sitemaps (scripts/pipeline/probe.ts)
  // Singapore
  { id: "singapore-management-university", origins: ["https://masters.smu.edu.sg"], listings: ["https://masters.smu.edu.sg/programmes"], include: "^/programme/(master|msc)-", browser: true },
  // SUTD: programmes linked from https://www.sutd.edu.sg/admissions/graduate/masters/ (checked 2026-10-18); MEng (Research) left out.
  {
    id: "singapore-university-of-technology-and-design",
    origins: ["https://www.sutd.edu.sg"],
    pages: [
      "master-of-architecture-programme", "master-of-science-in-design-and-artificial-intelligence-for-enterprise",
      "mtd-advanced-ic-design-technology", "mtd-ai-and-technology-in-education", "mtd-ai-and-technology-in-finance",
      "mtd-architectural-design-computation", "mtd-artificial-intelligence", "mtd-cybersecurity", "mtd-data-science", "mtd-healthtech-innovation",
    ].flatMap((p) => [`https://www.sutd.edu.sg/programme-listing/${p}`, `https://www.sutd.edu.sg/programme-listing/${p}/financing/tuition-fees`]),
  },
  // United Kingdom
  { id: "anglia-ruskin-university", origins: ["https://www.aru.ac.uk"], include: "^/study/postgraduate/[a-z0-9-]+$", exclude: "conversion-courses|subject-areas|how-to-apply|benefits|fees|funding|events|open-day|international|scholarship|faq|guide|why-|life|accommodation|entry-requirements|clearing|contact" },
  { id: "bangor-university", origins: ["https://www.bangor.ac.uk"], rewriteHost: { "bangorunivsite.prod.acquia-sites.com": "www.bangor.ac.uk" }, include: "^/courses/postgraduate-taught/[a-z0-9-]+-(msc|ma|mba|llm|med|mph|march)$" },
  { id: "brunel-university-london", origins: ["https://www.brunel.ac.uk"], include: "^/study/courses/[a-z0-9-]+-(msc|ma|mba|llm|med|mph)$" },
  { id: "canterbury-christ-church-university", origins: ["https://www.canterbury.ac.uk"], include: "^/study-here/courses/postgraduate/[a-z0-9-]+$" },
  { id: "coventry-university", origins: ["https://www.coventry.ac.uk"], include: "^/course-structure/pg/[a-z]+/[a-z0-9-]+-(msc|ma|mba|llm|med|mph|march)$" },
  { id: "cranfield-university", origins: ["https://www.cranfield.ac.uk"], include: "^/courses/taught/[a-z0-9-]+$", exclude: "a-to-z|apprenticeship", alsoPages: ["https://www.cranfield.ac.uk/som/mscmim"] },
  { id: "de-montfort-university", origins: ["https://www.dmu.ac.uk"], include: "^/study/courses/postgraduate-courses/[a-z0-9-]+/[a-z0-9-]+\\.aspx$", exclude: "module|fees|entry|apply|teaching|career|index|structure|assessment|facilities|placement|scholarship|international|how-" },
  { id: "edinburgh-napier-university", origins: ["https://www.napier.ac.uk"], include: "^/courses/(msc|ma|mba|llm|mfa)-[a-z0-9-]+-postgraduate-fulltime$" },
  { id: "goldsmiths-university-of-london", origins: ["https://www.gold.ac.uk"], include: "^/pg/(msc|ma|mba|llm|mfa|mmus|march)-[a-z0-9-]+$" },
  { id: "heriot-watt-university", origins: ["https://www.hw.ac.uk"], include: "^/study/postgraduate/[a-z0-9-]+$" },
  { id: "leeds-beckett-university", origins: ["https://www.leedsbeckett.ac.uk"], include: "^/courses/[a-z0-9-]+-(msc|ma|mba|llm|med|mph)$" },
  { id: "london-metropolitan-university", origins: ["https://www.londonmet.ac.uk"], include: "^/courses/postgraduate/[a-z0-9-]+-(msc|ma|mba|llm|med|mph)$", exclude: "top-up" },
  { id: "middlesex-university", origins: ["https://www.mdx.ac.uk"], include: "^/courses/postgraduate/[a-z0-9-]+$" },
  { id: "oxford-brookes-university", origins: ["https://www.brookes.ac.uk"], include: "^/courses/postgraduate/[a-z0-9-]+$" },
  { id: "queen-margaret-university-edinburgh", origins: ["https://www.qmu.ac.uk"], include: "^/study-here/postgraduate-study/2027/(msc|ma|mba|llm)-" },
  { id: "sheffield-hallam-university", origins: ["https://www.shu.ac.uk"], include: "^/courses/[a-z-]+/(msc|ma|mba|llm|med|mph)-" },
  { id: "soas-university-of-london", origins: ["https://www.soas.ac.uk"], include: "^/study/find-course/(msc|ma|mba|llm|mpa)-" },
  { id: "swansea-university", origins: ["https://www.swansea.ac.uk"], include: "^/postgraduate/taught/(.+/)?(msc|ma|mba|llm|mph|med)-[a-z0-9-]+$" },
  { id: "university-of-bradford", origins: ["https://www.bradford.ac.uk"], include: "^/courses/pg/[a-z0-9-]+$", exclude: "distance-learning" },
  { id: "university-of-brighton", origins: ["https://www.brighton.ac.uk"], include: "^/courses/study/[a-z0-9-]+-(msc|ma|mba|llm|med|mph|march)(-[a-z-]+)?\\.aspx$" },
  { id: "university-of-east-anglia", origins: ["https://www.uea.ac.uk"], include: "^/course/postgraduate/(msc|ma|mba|llm|mph|med)-" },
  { id: "university-of-east-london", origins: ["https://www.uel.ac.uk"], include: "^/postgraduate/courses/(msc|ma|mba|llm|mph|med|mpa)-" },
  { id: "university-of-greenwich", origins: ["https://www.gre.ac.uk"], include: "^/postgraduate-courses/[a-z]+/[a-z0-9-]+$", exclude: "apprenticeship", codes: true },
  { id: "university-of-hull", origins: ["https://www.hull.ac.uk"], include: "^/study/postgraduate-taught/courses/[a-z0-9-]+-(msc|ma|mba|llm|mph|med)$" },
  { id: "university-of-lancashire", origins: ["https://www.lancashire.ac.uk"], include: "^/postgraduate/courses/[a-z0-9-]+-(msc|ma|mba|llm|mph|med|mpa)$" },
  { id: "university-of-northampton", origins: ["https://www.northampton.ac.uk"], include: "^/courses/[a-z0-9-]+-(msc|ma|mba|llm|med)$", exclude: "top-up" },
  { id: "university-of-roehampton-london", origins: ["https://www.roehampton.ac.uk"], include: "^/study/postgraduate-taught-courses/[a-z0-9-]+$", exclude: "distance-learning|pgce" },
  { id: "university-of-salford", origins: ["https://www.salford.ac.uk"], include: "^/courses/postgraduate/[a-z0-9-]+$" },
  { id: "university-of-stirling", origins: ["https://www.stir.ac.uk"], include: "^/courses/pg-taught/[a-z0-9-]+$", exclude: "doctorate|edd-" },
  // Australia
  { id: "bond-university", origins: ["https://bond.edu.au"], include: "^/program/master-of-" },
  { id: "charles-darwin-university", origins: ["https://www.cdu.edu.au"], include: "^/study/course/master-" },
  { id: "flinders-university", origins: ["https://www.flinders.edu.au"], include: "^/study/courses/master-" },
  { id: "southern-cross-university", origins: ["https://www.scu.edu.au"], include: "^/study/courses/master-of-" },
  { id: "western-sydney-university", origins: ["https://www.westernsydney.edu.au"], listings: ["https://www.westernsydney.edu.au/future/study/courses/postgraduate"], include: "^/future/study/courses/postgraduate/master-of-", browser: true },
  { id: "james-cook-university", origins: ["https://www.jcu.edu.au"], listings: ["https://www.jcu.edu.au/courses/postgrad"], include: "^/courses/master-of-", browser: true },
  { id: "university-of-sunshine-coast", origins: ["https://www.unisc.edu.au"], include: "^/study/courses-and-programs/postgraduate-degrees/master-of-[a-z0-9-]+$" },
  { id: "victoria-university", origins: ["https://www.vu.edu.au"], include: "^/courses/master-of-" },
  // Ireland
  { id: "maynooth-university", origins: ["https://www.maynoothuniversity.ie"], include: "^/study-maynooth/postgraduate-studies/courses/[a-z0-9-]+$", exclude: "phd|higher-diploma|certificate|diploma" },
  { id: "technological-university-dublin", origins: ["https://www.tudublin.ie"], include: "^/study/postgraduate/courses/[^/]+$" },
  // Sites that reject scripted clients, built through the browser
  { id: "glasgow-caledonian-university", origins: ["https://www.gcu.ac.uk"], include: "^/study/courses/pg/(msc|ma|mba|llm)-", browser: true },
  { id: "kingston-university-london", origins: ["https://www.kingston.ac.uk"], include: "^/study/postgraduate/[a-z0-9-]+-(msc|ma|mba|llm|med|mph)$", browser: true },
  { id: "nottingham-trent-university", origins: ["https://www.ntu.ac.uk"], include: "^/course/[a-z-]+/pg/(msc|ma|mba|llm|mph|med)-", exclude: "flexible-learning|distance", browser: true },
  { id: "university-of-hertfordshire", origins: ["https://www.herts.ac.uk"], include: "^/courses/postgraduate-masters/(msc|ma|mba|llm|mph|med)-", browser: true },
  { id: "university-of-south-wales", origins: ["https://www.southwales.ac.uk"], include: "^/courses/(msc|ma|mba|llm|mph|med)-", browser: true },
  { id: "university-of-wolverhampton", origins: ["https://www.wlv.ac.uk"], include: "^/courses/(msc|ma|mba|llm|mph|med)-", browser: true },
  { id: "australian-catholic-university", origins: ["https://www.acu.edu.au"], include: "^/handbook/handbook-2027/course/master-of-", browser: true },
  { id: "edith-cowan-university", origins: ["https://www.ecu.edu.au"], include: "^/degrees/courses/master-of-", browser: true },
  { id: "university-of-notre-dame-australia", origins: ["https://www.notredame.edu.au"], include: "^/programs/[a-z-]+/postgraduate/master-of-", browser: true },
  { id: "university-of-tasmania", origins: ["https://www.utas.edu.au"], include: "^/courses/[a-z-]+/courses/[a-z0-9]+-master-of-", browser: true },
];

// ---------- Hong Kong, Macau and Singapore focus (2026-10-20): each university's official taught
// list, collected by scripts/pipeline/asia-catalogue.ts into lists/asia/<id>.json. These replace any
// earlier config for the university (e.g. NUS, which was in the manual queue).
const ASIA_DIR = path.join(import.meta.dirname, "lists", "asia");
for (const c of CATALOGUES) {
  const f = path.join(ASIA_DIR, `${c.id}.json`);
  if (!existsSync(f)) continue;
  const pages = (JSON.parse(readFileSync(f, "utf8")) as { pages: string[] }).pages;
  if (!pages.length) continue;
  const origins = [...new Set(pages.map((u) => new URL(u).origin))];
  const known = SOURCES.find((s) => s.id === c.id);
  if (known)
    Object.assign(known, { origins: [...new Set([...known.origins, ...origins])], pages, include: undefined, listings: undefined, sitemaps: undefined, skip: undefined, browser: c.browser ?? known.browser, keepQuery: c.keepQuery ?? known.keepQuery });
  else SOURCES.push({ id: c.id, origins, pages, browser: c.browser, keepQuery: c.keepQuery });
}
const fromCatalogue = new Set(CATALOGUES.map((c) => c.id).filter((id) => SOURCES.find((s) => s.id === id)?.pages?.length));

// ---------- Phase 1 expansion (QS top 500: US, Canada, New Zealand, Hong Kong, and the rest of
// the UK, Australia, Ireland and Singapore). Origins: lists/phase1-origins.json, each checked to
// load. Pages: lists/phase1/<id>.json, picked from the sitemaps by scripts/pipeline/auto-sources.ts.
// A university that already has a hand-made source keeps it and gains the sitemap pages.

const PHASE1_DIR = path.join(import.meta.dirname, "lists", "phase1");
/** The sitemap pages inside the university's programme catalogue (lists/phase1-include.json); none when it has no entry. */
const phase1Pages = (id: string): string[] => {
  const f = path.join(PHASE1_DIR, `${id}.json`);
  const include = (phase1Include.include as Record<string, string>)[id];
  if (!include || !existsSync(f)) return [];
  const re = new RegExp(include, "i");
  return (JSON.parse(readFileSync(f, "utf8")) as { pages: string[] }).pages.filter((u) => re.test(u.replace(/^https?:\/\/(www\.)?/, "")));
};

for (const [id, origins] of Object.entries(phase1.origins)) {
  const pages = phase1Pages(id);
  const browser = origins.some((o) => phase1.browser.includes(o));
  const known = SOURCES.find((s) => s.id === id);
  if (known) {
    // The AI-assistant opt-out no longer excludes a site (2026-10-19): its tested config is used as is.
    if (known.skip && /AI assistants/.test(known.skip)) {
      delete known.skip;
      continue;
    }
    // A catalogue's list (lists/asia/) gains the sitemap pages. Other known sources are in phase 1
    // because their config found nothing: the sitemap pages replace it.
    if (pages.length && fromCatalogue.has(id)) known.pages = [...new Set([...known.pages!, ...pages])];
    else if (pages.length && !known.skip) Object.assign(known, { pages, include: undefined, listings: undefined });
    continue;
  }
  const keepQuery = (phase1Include.keepQuery ?? []).includes(id) || undefined;
  SOURCES.push(pages.length ? { id, origins, pages, browser, keepQuery } : { id, origins, browser, skip: "no master's programme catalogue found in the sitemaps; manual queue" });
}
