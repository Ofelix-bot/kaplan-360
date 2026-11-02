// Employers checked for Singapore openings, per career. Candidates come from the Fortune Global 500
// 2026, LinkedIn Top Companies Singapore 2026 and the employers named in Kaplan's 2021/22 graduate
// survey, plus Singapore's large public employers (health clusters, the public service) where those
// lists have none for a career. Each `search` builds the employer's own careers-site search for a
// keyword in Singapore. Only the employer's official careers site is read.
//
// Two modes read this list (scripts/careers/check-openings.ts):
// - the old careers mode: `careers` × SEARCH_TERMS / ROLE_SCOPE (unchanged);
// - `--roles`: `industries` × the hot roles of those industries in data/raw/careers-roles.json, each with
//   its own search_term / search_scope. An employer with `careers: []` takes part in `--roles` only.
// The Big Four (Deloitte, PwC, EY, KPMG) are in Kaplan's graduate-employer list (Degree Enrolment Day
// deck, p. 13) and are probed for the accountancy and financial-services roles.

export type Employer = {
  id: string;
  name: string;
  /** Name as Fortune lists it, when the company is in the Fortune Global 500 2026. */
  fortuneName?: string;
  linkedinTopSg2026?: boolean;
  /** Name as given in data/raw/kaplan-degree-enrolment-day-2026-03.json (graduateEmployers.namesEn). */
  kaplanGraduatesName?: string;
  careersUrl: string;
  search: (keyword: string) => string;
  /** Skills Framework industry ids (lib/careers/industries.ts) whose hot roles are searched in `--roles` mode. */
  industries: string[];
  /** Old careers mode: career ids in data/raw/careers.json. */
  careers: string[];
  /** Set when the site lists Singapore jobs only and shows no location per posting; says why. */
  singaporeOnly?: string;
  /** Not checked, with the reason (robots.txt, or a search the site doesn't accept by URL). */
  skip?: string;
};

const q = encodeURIComponent;

export const SEARCH_TERMS: Record<string, string> = {
  "data-analyst-scientist": "data analyst",
  "ai-ml-engineer": "machine learning engineer",
  "cybersecurity-analyst": "cyber security",
  "financial-analyst-fintech": "financial analyst",
  "digital-marketing-manager": "digital marketing",
  "supply-chain-logistics-manager": "supply chain",
  "software-engineer": "software engineer",
  "registered-nurse": "staff nurse",
  "counsellor-psychology-associate": "counsellor",
  "communications-pr": "communications",
};

/** What counts as this career when reading job titles (and what does not). */
export const ROLE_SCOPE: Record<string, string> = {
  "data-analyst-scientist": "data analyst, data scientist, business intelligence or analytics roles. Not data engineers building pipelines only, not finance analysts.",
  "ai-ml-engineer": "machine learning engineer, AI engineer, applied scientist, ML research engineer, AI/ML software engineer.",
  "cybersecurity-analyst": "cyber/information security analyst, engineer, SOC, threat, security operations or security risk roles.",
  "financial-analyst-fintech": "financial analyst, FP&A, investment or equity analyst, corporate finance, valuation, financial planning, fintech product/finance analyst. Not credit recovery, collections, sales, audit or risk-only roles.",
  "digital-marketing-manager": "digital marketing, performance/growth marketing, social media, SEO/SEM, content or brand marketing roles.",
  "supply-chain-logistics-manager": "supply chain, logistics, procurement/sourcing, demand/supply planning, inventory, distribution or operations planning roles.",
  "software-engineer": "software engineer/developer roles of any level (backend, frontend, full-stack, mobile, platform).",
  "registered-nurse": "registered/staff nurse roles of any grade, including senior staff nurse and nurse clinician. Not enrolled nurses or healthcare assistants.",
  "counsellor-psychology-associate": "counsellor, psychologist, psychology associate, mental health or social-emotional support roles. Not genetic counsellors or financial counsellors.",
  "communications-pr": "communications, corporate communications, public relations, media relations, internal communications or content/editorial roles.",
};

export const EMPLOYERS: Employer[] = [
  { id: "google", name: "Google", fortuneName: "Alphabet", linkedinTopSg2026: true, kaplanGraduatesName: "Google", careersUrl: "https://www.google.com/about/careers/applications/jobs/results", search: (k) => `https://www.google.com/about/careers/applications/jobs/results?q=${q(k)}&location=Singapore`, industries: ["infocomm-technology", "media"], careers: ["data-analyst-scientist", "ai-ml-engineer", "software-engineer", "digital-marketing-manager", "cybersecurity-analyst"] },
  { id: "microsoft", name: "Microsoft", fortuneName: "Microsoft", linkedinTopSg2026: true, kaplanGraduatesName: "Microsoft", careersUrl: "https://jobs.careers.microsoft.com/global/en/search", search: (k) => `https://jobs.careers.microsoft.com/global/en/search?q=${q(k)}&lc=Singapore`, industries: ["infocomm-technology"], careers: ["ai-ml-engineer", "software-engineer", "cybersecurity-analyst", "data-analyst-scientist"], skip: "location filter not applied by URL and its search API is not reachable; to fix" },
  { id: "amazon", name: "Amazon", fortuneName: "Amazon", kaplanGraduatesName: "Amazon", careersUrl: "https://www.amazon.jobs", search: (k) => `https://www.amazon.jobs/en/search.json?base_query=${q(k)}&normalized_country_code%5B%5D=SGP&result_limit=50`, industries: ["infocomm-technology", "logistics", "retail"], careers: ["software-engineer", "ai-ml-engineer", "data-analyst-scientist", "supply-chain-logistics-manager", "cybersecurity-analyst", "digital-marketing-manager"] },
  { id: "apple", name: "Apple", fortuneName: "Apple", linkedinTopSg2026: true, kaplanGraduatesName: "Apple South Asia", careersUrl: "https://jobs.apple.com/en-sg/search", search: (k) => `https://jobs.apple.com/en-sg/search?search=${q(k)}&location=singapore-SGP`, industries: ["infocomm-technology", "media", "retail"], careers: ["supply-chain-logistics-manager", "software-engineer", "ai-ml-engineer"] },
  { id: "jpmorgan", name: "JPMorgan Chase", fortuneName: "JPMorgan Chase", linkedinTopSg2026: true, careersUrl: "https://careers.jpmorgan.com", search: (k) => `https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?keyword=${q(k)}&location=Singapore&locationId=300000000289362`, industries: ["financial-services"], careers: ["financial-analyst-fintech", "software-engineer", "cybersecurity-analyst", "data-analyst-scientist"], skip: "results load after the page settles; to fix" },
  { id: "citi", name: "Citi", fortuneName: "Citigroup", linkedinTopSg2026: true, kaplanGraduatesName: "Citibank", careersUrl: "https://jobs.citi.com", search: (k) => `https://jobs.citi.com/search-jobs/${q(k)}/Singapore/287/1/2/1880251/1x36667/103x83333/50/2`, industries: ["financial-services"], careers: ["financial-analyst-fintech", "cybersecurity-analyst", "data-analyst-scientist", "software-engineer"], skip: "robots.txt disallows the job search" },
  { id: "goldman-sachs", name: "Goldman Sachs", fortuneName: "Goldman Sachs Group", linkedinTopSg2026: true, careersUrl: "https://higher.gs.com", search: (k) => `https://higher.gs.com/results?search=${q(k)}&LOCATION=Singapore`, industries: ["financial-services"], careers: ["financial-analyst-fintech", "software-engineer"], skip: "robots.txt disallows the job search" },
  { id: "standard-chartered", name: "Standard Chartered", fortuneName: "Standard Chartered", linkedinTopSg2026: true, kaplanGraduatesName: "Standard Chartered", careersUrl: "https://jobs.standardchartered.com", search: (k) => `https://jobs.standardchartered.com/search/?q=${q(k)}&locationsearch=Singapore`, industries: ["financial-services"], careers: ["financial-analyst-fintech", "cybersecurity-analyst", "data-analyst-scientist", "software-engineer", "communications-pr"] },
  { id: "barclays", name: "Barclays", fortuneName: "Barclays", linkedinTopSg2026: true, careersUrl: "https://search.jobs.barclays", search: (k) => `https://search.jobs.barclays/search-jobs/${q(k)}/Singapore/22545/1/2/1880251/1x36667/103x83333/50/2`, industries: ["financial-services"], careers: ["financial-analyst-fintech", "cybersecurity-analyst"] },
  { id: "hsbc", name: "HSBC", fortuneName: "HSBC Holdings", careersUrl: "https://mycareer.hsbc.com", search: (k) => `https://mycareer.hsbc.com/en_GB/external/SearchJobs/${q(k)}?listFilterMode=1&jobRecordsPerPage=25&2041=%5B6099%5D&2041_format=1665`, industries: ["financial-services"], careers: ["financial-analyst-fintech", "cybersecurity-analyst"], skip: "new careers site; to fix" },
  { id: "dbs", name: "DBS Bank", linkedinTopSg2026: true, careersUrl: "https://www.dbs.com/careers", search: (k) => `https://dbs.wd3.myworkdayjobs.com/en-US/DBS_Careers?q=${q(k)}`, industries: ["financial-services"], careers: ["data-analyst-scientist", "ai-ml-engineer", "cybersecurity-analyst", "financial-analyst-fintech", "software-engineer", "digital-marketing-manager", "communications-pr"] },
  { id: "accenture", name: "Accenture", fortuneName: "Accenture", kaplanGraduatesName: "Accenture", careersUrl: "https://www.accenture.com/sg-en/careers", search: (k) => `https://www.accenture.com/sg-en/careers/jobsearch?jk=${q(k)}&sb=1&vw=0&is_rj=0&pg=1`, industries: ["infocomm-technology"], careers: ["cybersecurity-analyst", "data-analyst-scientist", "ai-ml-engineer", "software-engineer", "digital-marketing-manager"], skip: "robots.txt disallows the job search" },
  { id: "procter-gamble", name: "Procter & Gamble", fortuneName: "Procter & Gamble", kaplanGraduatesName: "Procter & Gamble", careersUrl: "https://www.pgcareers.com", search: (k) => `https://www.pgcareers.com/global/en/search-results?keywords=${q(k)}&location=Singapore`, industries: ["retail", "wholesale-trade"], careers: ["supply-chain-logistics-manager", "digital-marketing-manager", "financial-analyst-fintech"] },
  { id: "nike", name: "Nike", fortuneName: "Nike", kaplanGraduatesName: "Nike", careersUrl: "https://careers.nike.com", search: (k) => `https://careers.nike.com/jobs?keyword=${q(k)}&location=Singapore`, industries: ["retail"], careers: ["digital-marketing-manager", "supply-chain-logistics-manager"], skip: "location filter not applied by URL; to fix" },
  { id: "maersk", name: "Maersk", fortuneName: "Maersk Group", careersUrl: "https://www.maersk.com/careers", search: (k) => `https://www.maersk.com/careers/vacancies?search=${q(k)}&location=Singapore`, industries: ["logistics"], careers: ["supply-chain-logistics-manager", "financial-analyst-fintech"], skip: "robots.txt disallows the job search" },
  { id: "micron", name: "Micron Technology", fortuneName: "Micron Technology", linkedinTopSg2026: true, careersUrl: "https://careers.micron.com", search: (k) => `https://careers.micron.com/careers?query=${q(k)}&location=Singapore`, industries: ["infocomm-technology", "logistics"], careers: ["supply-chain-logistics-manager", "data-analyst-scientist", "software-engineer"] },
  { id: "roche", name: "Roche", fortuneName: "Roche Group", linkedinTopSg2026: true, careersUrl: "https://careers.roche.com", search: (k) => `https://careers.roche.com/global/en/search-results?keywords=${q(k)}&location=Singapore`, industries: ["infocomm-technology", "logistics"], careers: ["data-analyst-scientist", "supply-chain-logistics-manager", "communications-pr"], skip: "location filter not applied by URL; to fix" },
  { id: "msd", name: "MSD", fortuneName: "Merck", linkedinTopSg2026: true, careersUrl: "https://jobs.msd.com", search: (k) => `https://jobs.msd.com/gb/en/search-results?keywords=${q(k)}&location=Singapore`, industries: ["infocomm-technology", "logistics"], careers: ["data-analyst-scientist", "supply-chain-logistics-manager"] },
  { id: "hp", name: "HP", fortuneName: "HP", linkedinTopSg2026: true, careersUrl: "https://jobs.hp.com", search: (k) => `https://jobs.hp.com/jobs/?keyword=${q(k)}&location=Singapore`, industries: ["infocomm-technology", "retail"], careers: ["supply-chain-logistics-manager", "software-engineer", "digital-marketing-manager"], skip: "search URL returns 404; to fix" },
  { id: "singapore-airlines", name: "Singapore Airlines", kaplanGraduatesName: "Singapore Airlines", careersUrl: "https://www.singaporeair.com/en_UK/sg/careers/", search: () => "https://www.singaporeair.com/en_UK/sg/careers/job-openings/", industries: ["tourism", "logistics"], careers: ["communications-pr", "digital-marketing-manager", "data-analyst-scientist"], skip: "no searchable job list; to fix" },
  { id: "singhealth", name: "SingHealth", careersUrl: "https://www.singhealth.com.sg/careers", search: (k) => `https://careers.singhealth.com.sg/search/?q=${q(k)}`, industries: ["healthcare", "social-service"], careers: ["registered-nurse", "counsellor-psychology-associate"] },
  { id: "nuhs", name: "National University Health System (NUHS)", careersUrl: "https://www.nuhs.edu.sg/careers", search: (k) => `https://careers.nuhs.edu.sg/search/?q=${q(k)}`, industries: ["healthcare", "social-service"], careers: ["registered-nurse", "counsellor-psychology-associate"], skip: "careers site unreachable; to fix" },
  { id: "nhg", name: "National Healthcare Group (NHG Health)", careersUrl: "https://careers.nhghealth.com.sg/", search: (k) => `https://careers.nhghealth.com.sg/search/?q=${q(k)}`, industries: ["healthcare", "social-service"], careers: ["registered-nurse", "counsellor-psychology-associate"] },
  { id: "public-service", name: "Singapore Public Service (Careers@Gov)", careersUrl: "https://www.careers.gov.sg", search: (k) => `https://www.careers.gov.sg/jobs-listing?keyword=${q(k)}`, industries: ["social-service", "early-childhood", "healthcare"], careers: ["counsellor-psychology-associate", "data-analyst-scientist", "cybersecurity-analyst", "communications-pr", "software-engineer"], skip: "Careers@Gov search does not take a keyword in the URL; to fix" },
  // Big Four: SuccessFactors job searches (robots.txt allows /search/; it disallows only /applybutton/,
  // /talentcommunity/, /services/ and similar; each search page was read once and lists jobs as server HTML)
  // and PwC's Workday site (robots.txt allows /Global_Experienced_Careers/, but the location filter is not a URL parameter).
  { id: "deloitte", name: "Deloitte", kaplanGraduatesName: "Deloitte", careersUrl: "https://jobs.sea.deloitte.com", search: (k) => `https://jobs.sea.deloitte.com/search/?q=${q(k)}&locationsearch=Singapore`, industries: ["accountancy", "financial-services"], careers: [] },
  { id: "pwc", name: "PwC", kaplanGraduatesName: "PwC", careersUrl: "https://www.pwc.com/sg/en/careers.html", search: (k) => `https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers?q=${q(k)}&locationCountry=80938777cac5440fab50d729f9634969`, industries: ["accountancy", "financial-services"], careers: [], skip: "location filter not applied by URL (probe: a Singapore search lists PwC jobs worldwide); to fix" },
  { id: "ey", name: "EY", careersUrl: "https://careers.ey.com", search: (k) => `https://careers.ey.com/ey/search/?q=${q(k)}&locationsearch=Singapore`, industries: ["accountancy", "financial-services"], careers: [] },
  { id: "kpmg", name: "KPMG", kaplanGraduatesName: "KPMG", careersUrl: "https://careers.kpmg.com.sg", search: (k) => `https://careers.kpmg.com.sg/search/?q=${q(k)}`, industries: ["accountancy", "financial-services"], careers: [], singaporeOnly: "careers.kpmg.com.sg is KPMG in Singapore's own careers site and lists Singapore jobs only" },
  { id: "mediacorp", name: "Mediacorp", kaplanGraduatesName: "Mediacorp", careersUrl: "https://www.mediacorp.sg/careers", search: () => "https://www.mediacorp.sg/careers", industries: ["media"], careers: ["communications-pr", "digital-marketing-manager"], skip: "no searchable job list; to fix" },
];
