// Official programme pages for the top-up section (decided 2026-10-20): Kaplan Singapore's partner
// bachelor's degrees first, then other Singapore private institutions' top-up degrees.
// Kaplan URLs are from www.kaplan.com.sg/sitemap.xml (checked 2026-10-20); the three marked
// "not in sitemap" are guesses from Kaplan's slug pattern and are reported if they 404.

export type TopupSource = {
  /** Who teaches it in Singapore: "kaplan", or the provider's id in PROVIDERS. */
  provider: string;
  url: string;
  /** For Kaplan pages: the id in data/raw/kaplan-programmes.json. */
  kaplanId?: string;
};

export type Provider = {
  id: string;
  name: string;
  /** Pages listing the provider's degrees; links matching `follow` (same site) are read as programme pages. */
  hubs: string[];
  /** Or: the site's sitemap URLs whose path matches this pattern are read as programme pages. */
  sitemap?: { origin: string; pattern: string };
  follow?: string;
  exclude?: string;
  pages?: string[];
  browser?: boolean;
};

const K = "https://www.kaplan.com.sg/bachelors-degree/";

/** [kaplan-programmes.json id, page slug] */
const KAPLAN: [string, string][] = [
  ["murdoch-bachelor-of-business-in-accounting", "bachelor-of-business-in-accounting-single-major"],
  ["murdoch-bachelor-of-business-in-banking", "bachelor-of-business-in-banking-single-major"],
  ["murdoch-bachelor-of-business-in-finance", "bachelor-of-business-in-finance-single-major"],
  ["murdoch-bachelor-of-business-in-business-law", "bachelor-of-business-in-business-law-single-major"],
  ["murdoch-bachelor-of-business-in-human-resources-management", "bachelor-of-business-in-human-resources-management-single-major"],
  ["murdoch-bachelor-of-business-in-international-business", "bachelor-of-business-in-international-business-single-major"],
  ["murdoch-bachelor-of-business-in-management", "bachelor-of-business-in-management-single-major"],
  ["murdoch-bachelor-of-business-in-marketing", "bachelor-of-business-in-marketing-single-major"],
  ["murdoch-bachelor-of-business-in-hospitality-and-tourism-management", "bachelor-of-business-in-hospitality-and-tourism-management-single-major"],
  ["murdoch-bachelor-of-communication-in-communication-and-media-studies", "bachelor-of-communication-in-communication-and-media-studies"],
  ["murdoch-bachelor-of-communication-in-digital-communication", "bachelor-of-communication-in-digital-communication"],
  ["murdoch-bachelor-of-communication-in-strategic-communication", "bachelor-of-communication-in-strategic-communication-single-major"],
  ["murdoch-bachelor-of-information-technology-in-artificial-intelligence-and-autonomous-systems", "bachelor-of-information-technology-in-artificial-intelligence-and-autonomous-systems-single-major"],
  ["murdoch-bachelor-of-information-technology-in-business-information-systems", "bachelor-of-information-technology-in-business-information-systems-single-major"],
  ["murdoch-bachelor-of-information-technology-in-computer-science", "bachelor-of-information-technology-in-computer-science-single-major"],
  ["murdoch-bachelor-of-information-technology-in-cyber-security-and-forensics", "bachelor-of-information-technology-in-cyber-security-and-forensics-single-major"],
  ["murdoch-bachelor-of-information-technology-in-games-design-and-development", "bachelor-of-information-technology-in-games-design-and-development"],
  ["murdoch-bachelor-of-data-analytics-in-business-intelligence", "bachelor-of-data-analytics-in-business-intelligence"],
  ["murdoch-bachelor-of-data-analytics-in-data-science", "bachelor-of-data-analytics-in-data-science"], // not in sitemap
  ["murdoch-bachelor-of-data-analytics-in-fintech-minor-in-information-security-systems", "bachelor-of-data-analytics-in-fintech"], // not in sitemap
  ["murdoch-bachelor-of-psychology-in-psychological-science", "bachelor-of-psychology-in-psychological-science"],
  ["murdoch-bachelor-of-criminology-in-criminal-behaviour", "bachelor-of-criminology-in-criminal-behaviour-single-major"],
  ["northumbria-bsc-hons-global-business-management", "bachelor-of-science-honours-global-business-management"],
  ["northumbria-bsc-hons-global-business-management-logistics-and-supply-chain", "bachelor-of-science-honours-global-business-management-logistics-and-supply-chain"],
  ["northumbria-bsc-hons-global-business-management-human-resources", "bachelor-of-science-honours-global-business-management-human-resources"],
  ["northumbria-bsc-hons-international-tourism-hospitality-and-events", "bachelor-of-science-honours-international-tourism-hospitality-and-events"],
  ["northumbria-ba-hons-mass-communication-with-public-relations-top-up", "bachelor-of-arts-honours-mass-communication-public-relations-top-up"],
  ["northumbria-ba-hons-in-childhood-and-early-years-studies-top-up", "bachelor-of-arts-honours-in-childhood-and-early-years-studies-top-up"],
  ["northumbria-ba-hons-in-guidance-and-counselling-top-up", "bachelor-of-arts-honours-guidance-and-counselling-top-up"],
  ["northumbria-bsc-hons-in-psychology-clinical-psychology-top-up", "bachelor-of-science-honours-psychology-clinical-psychology-top-up"], // not in sitemap
  ["northumbria-bachelor-of-science-nursing-top-up-for-registered-nurses", "bachelor-of-science-nursing-course-top-up"],
  ["bcu-ba-hons-business-administration-top-up", "bachelor-of-arts-honours-business-administration-top-up"],
  ["bcu-ba-hons-international-marketing-top-up", "bachelor-of-arts-honours-international-marketing-top-up"],
  ["bcu-ba-hons-in-international-business-top-up", "bachelor-of-arts-honours-in-international-business-top-up"],
  ["bcu-ba-with-honours-digital-marketing-top-up", "bachelor-of-arts-with-honours-digital-marketing-top-up"],
  ["bcu-bsc-with-honours-construction-management-top-up", "bachelor-of-science-with-honours-construction-management-top-up"],
  ["bcu-bachelor-of-laws-honours-top-up", "bachelor-of-laws-honours-top-up"],
  ["bcu-bsc-with-honours-computer-science-global-top-up", "bachelor-of-science-with-honours-computer-science-global-top-up"],
  ["bcu-bsc-with-honours-computer-science-with-artificial-intelligence-global-top-up", "bachelor-of-science-with-honours-computer-science-with-artificial-intelligence-global-top-up"],
  ["bcu-bsc-with-honours-cyber-security-global-top-up", "bachelor-of-science-with-honours-cyber-security-global-top-up"],
  ["bcu-bsc-with-honours-digital-forensics-global-top-up", "bachelor-of-science-with-honours-digital-forensics-global-top-up"],
  ["portsmouth-ba-hons-in-accountancy-and-financial-management-top-up", "bachelor-of-arts-honours-in-accountancy-and-financial-management-top-up"],
  ["portsmouth-bsc-hons-computer-science-top-up", "bachelor-of-science-honours-computer-science-top-up"],
  ["portsmouth-bsc-hons-cyber-security-and-forensic-computing-top-up", "bachelor-of-science-honours-cyber-security-and-forensic-computing-top-up"],
  ["portsmouth-bsc-hons-data-science-and-analytics-top-up", "bachelor-of-science-honours-data-science-and-artificial-intelligence-top-up"],
  ["portsmouth-bsc-with-honours-in-psychology-top-up", "bachelor-of-science-with-honours-in-psychology-top-up"],
  ["ucd-bachelor-of-business-studies-honours-business-analytics-top-up", "business-analytics-bachelor-of-business-studies-honours-top-up"],
  ["ucd-bachelor-of-business-studies-honours-digital-business-top-up", "bachelor-of-business-studies-honours-digital-business-top-up"],
  ["ucd-bachelor-of-business-studies-honours-fintech-top-up", "bachelor-of-business-studies-honours-fintech-top-up"],
  ["ucd-bachelor-of-business-studies-honours-finance-top-up", "bachelor-of-business-studies-honours-finance-top-up"],
  ["ucd-bachelor-of-business-studies-honours-human-resource-management-top-up", "bachelor-of-business-studies-honours-human-resource-management-top-up"],
  ["ucd-bachelor-of-business-studies-honours-logistics-and-supply-chain-management-top-up", "supply-chain-management-course-bachelor-business-studies-honours-top-up"],
  ["ucd-bachelor-of-business-studies-honours-management-top-up", "bachelor-of-business-studies-honours-management-top-up"],
  ["ucd-bachelor-of-business-studies-honours-marketing-top-up", "bachelor-of-business-studies-honours-digital-marketing-top-up"],
  ["ucd-bachelor-of-business-studies-honours-project-management-top-up", "bachelor-of-business-studies-honours-project-management-top-up"],
  ["monash-bachelor-of-education-in-early-childhood-top-up", "bachelor-education-early-childhood-top-up"],
];

export const KAPLAN_SOURCES: TopupSource[] = KAPLAN.map(([kaplanId, s]) => ({ provider: "kaplan", url: K + s, kaplanId }));

/** Kaplan pages about scholarships and admission for all its degrees. */
export const KAPLAN_SHARED = [
  "https://www.kaplan.com.sg/university/murdoch-university/scholarships",
  "https://www.kaplan.com.sg/international-applicants-admission-criteria",
  "https://www.kaplan.com.sg/international-applicants-chinese-service-centre-for-scholarly-exchange-cscse-accreditation",
  "https://www.kaplan.com.sg/progression-pathways/options-after-polytechnic",
];

/** Other institutions, in the order agreed on 2026-10-20 (sitemaps checked that day). */
export const PROVIDERS: Provider[] = [
  {
    id: "psb-academy",
    name: "PSB Academy",
    hubs: [],
    sitemap: { origin: "https://www.psb-academy.edu.sg", pattern: "^/[a-z-]*university[a-z-]*/bachelor-of-" },
  },
  {
    id: "sim",
    name: "Singapore Institute of Management",
    hubs: [],
    // Double degrees ("…-and-bachelor-of-…") are left out; each single degree is listed on its own.
    sitemap: { origin: "https://www.sim.edu.sg", pattern: "^/degrees-diplomas/programmes/programme-listing/(uofa_)?bachelor-of-(?!.*-and-bachelor-of-)(?!.*bachelor-of-arts-.*-and-)" },
  },
  {
    id: "jcu-singapore",
    name: "James Cook University, Singapore",
    hubs: [],
    sitemap: { origin: "https://www.jcu.edu.sg", pattern: "^/courses-and-study/courses/course/bachelor-of-" },
    browser: true,
  },
  {
    id: "curtin-singapore",
    name: "Curtin Singapore",
    hubs: [],
    sitemap: { origin: "https://www.curtin.edu.sg", pattern: "^/courses/undergraduate/bachelor-of-[a-z-]+/([a-z-]+/)?$" },
  },
  {
    id: "amity-singapore",
    name: "Amity Global Institute",
    hubs: [],
    sitemap: { origin: "https://www.amitysingapore.sg", pattern: "^/courses/bachelor-of-" },
  },
];
