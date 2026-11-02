// Official pages for the Benefits section: scholarships and fee reductions for international
// postgraduate students, application-fee waivers, application deadlines, and events for students in
// Singapore. `hubs` are read and their links matching `follow` (same site) are read too.
// Kaplan Singapore's partner universities first; checked 2026-10-18.

export type BenefitSource = {
  institutionId: string;
  hubs: string[];
  /** Award pages read as well, listed explicitly (from the site's sitemap) when the hubs don't link them. */
  pages?: string[];
  /** Path pattern for pages linked from the hubs that describe one award or event. */
  follow?: string;
  /** Path pattern to leave out (archived awards, undergraduate-only pages). */
  exclude?: string;
  browser?: boolean;
};

/** Linked pages read when a source gives no `follow`: one award or funding page each. */
export const DEFAULT_FOLLOW = "(scholarship|bursar|award|discount|funding)";
export const DEFAULT_EXCLUDE = "(undergrad|\\bug\\b|phd|doctoral|research-degree|pgr|news|events?/|blog|faq|terms|apply|contact|loans?|current-students|\\.(ico|css|js|png|jpe?g|svg|gif|pdf|docx?)$)";

export const BENEFIT_SOURCES: BenefitSource[] = [
  {
    institutionId: "aston-university",
    hubs: ["https://www.aston.ac.uk/international/scholarships", "https://www.aston.ac.uk/aston-business-school/aston-mba/mba-scholarships"],
    follow: "^/international/scholarships/[a-z0-9-]+$",
  },
  {
    institutionId: "birmingham-city-university",
    hubs: [
      "https://www.bcu.ac.uk/international/fees-costs-and-scholarships/pg-scholarships",
      "https://www.bcu.ac.uk/international/bcu-in-your-country/singapore",
    ],
    follow: "^/international/fees-costs-and-scholarships/pg-scholarships/[a-z0-9-]+$",
  },
  {
    institutionId: "northumbria-university-at-newcastle",
    hubs: ["https://www.northumbria.ac.uk/study-at-northumbria/fees-funding/pg-fees-funding/2026-27-alumni-discount/"],
    // 2026/27 awards from the sitemap (the funding page still links the 2025/26 ones); UK-only awards are dropped by the reader.
    pages: [
      "kans-and-kandy-charitable-trust-scholarships-2627", "the-institute-postgraduate-scholarships-2627", "the-robson-laidler-scholarship-2627",
      "mott-macdonald-postgraduate-scholarship-2627", "hachette-ma-publishing-scholarship-2627", "wubbleyou-postgraduate-scholarship-2627",
      "the-barden-scholarship-2627", "bar-scholarship-2627",
    ].map((p) => `https://www.northumbria.ac.uk/study-at-northumbria/fees-funding/pg-fees-funding/${p}/`),
  },
  {
    institutionId: "university-of-portsmouth",
    hubs: [
      "https://www.port.ac.uk/study/international-students/funding/scholarships",
      "https://www.port.ac.uk/study/masters-and-postgraduate-taught/fees-and-funding/scholarships-and-bursaries",
      "https://www.port.ac.uk/study/international-students/how-to-apply/application-deadlines",
      "https://www.port.ac.uk/study/international-students/your-country/singapore",
      "https://www.port.ac.uk/study/international-students/meet-us",
    ],
    follow: "^/study/(international-students/funding/scholarships|masters-and-postgraduate-taught/fees-and-funding/scholarships-and-bursaries)/[a-z0-9-]+$",
  },
  {
    institutionId: "murdoch-university",
    hubs: ["https://www.murdoch.edu.au/study/international-students/studying-at-murdoch/fees-and-scholarships", "https://www.murdoch.edu.au/study/scholarships/find-a-scholarship"],
    follow: "^/study/scholarships/find-a-scholarship/[a-z0-9-]+$",
    browser: true,
  },
  {
    institutionId: "monash-university",
    hubs: ["https://www.monash.edu/study/fees-scholarships/scholarships", "https://www.monash.edu/study/fees-scholarships/international-study-grants"],
    follow: "^/study/fees-scholarships/scholarships/find-a-scholarship/[a-z0-9-]+$",
    browser: true,
  },
  {
    institutionId: "university-college-dublin",
    hubs: ["https://www.ucd.ie/global/study-at-ucd/scholarshipsfinances/scholarships/?c2=Graduate", "https://www.smurfitschool.ie/admissions/scholarships/"],
    follow: "^/global/study-at-ucd/scholarshipsfinances/scholarships/[a-z0-9]+$",
    browser: true,
  },
  // Universities Singapore students often apply to (tier 1), checked 2026-10-19. Without "follow", links
  // whose path names a scholarship, bursary, award, discount or funding are read (DEFAULT_FOLLOW).
  { institutionId: "ucl", hubs: ["https://www.ucl.ac.uk/scholarships/"], browser: true },
  { institutionId: "king-s-college-london", hubs: ["https://www.kcl.ac.uk/study/postgraduate-taught/fees-and-funding"] },
  { institutionId: "imperial-college-london", hubs: ["https://www.imperial.ac.uk/study/fees-and-funding/"] },
  { institutionId: "university-of-manchester", hubs: ["https://www.manchester.ac.uk/study/international/finance-and-scholarships/funding/"] },
  { institutionId: "university-of-edinburgh", hubs: ["https://registryservices.ed.ac.uk/student-funding/postgraduate/international"], browser: true },
  { institutionId: "university-of-warwick", hubs: ["https://warwick.ac.uk/services/dc/schols_fund/applicants/competitions/"] },
  { institutionId: "london-school-of-economics-and-political-science", hubs: ["https://www.lse.ac.uk/study-at-lse/Graduate/fees-and-funding"] },
  { institutionId: "university-of-bristol", hubs: ["https://www.bristol.ac.uk/international/fees-finance/scholarships/"] },
  { institutionId: "university-of-leeds", hubs: ["https://www.leeds.ac.uk/international-scholarships"] },
  { institutionId: "university-of-glasgow", hubs: ["https://www.gla.ac.uk/scholarships/"] },
  { institutionId: "university-of-sheffield", hubs: ["https://sheffield.ac.uk/international/fees-and-funding/scholarships"], browser: true },
  { institutionId: "university-of-southampton", hubs: ["https://www.southampton.ac.uk/study/fees-funding/postgraduate/scholarships"] },
  {
    institutionId: "university-of-melbourne",
    hubs: [],
    pages: ["melbourne-international-graduate-scholarship", "melbourne-international-excellence-scholarship-graduate", "melbourne-international-pathway-scholarship", "melbourne-graduate-scholarship"].map(
      (p) => `https://scholarships.unimelb.edu.au/awards/${p}`,
    ),
    browser: true,
  },
  { institutionId: "university-of-sydney", hubs: ["https://www.sydney.edu.au/scholarships/international.html"], browser: true },
  { institutionId: "university-of-new-south-wales", hubs: ["https://www.scholarships.unsw.edu.au/"] },
  {
    institutionId: "university-of-queensland",
    hubs: [],
    pages: ["uq-international-excellence-scholarship", "uq-international-high-achievers-scholarship-global"].map((p) => `https://scholarships.uq.edu.au/scholarship/${p}`),
  },
  { institutionId: "rmit-university", hubs: ["https://www.rmit.edu.au/scholarships"], follow: "^/scholarships/international-scholarships/[a-z0-9-]+$" },
  { institutionId: "trinity-college-dublin-the-university-of-dublin", hubs: ["https://www.tcd.ie/study/international/scholarships/", "https://www.tcd.ie/study/country/singapore/"], browser: true },
  { institutionId: "nanyang-technological-university-singapore", hubs: ["https://www.ntu.edu.sg/admissions/graduate/financialmatters/scholarships"], follow: "^/admissions/graduate/financialmatters/scholarships/[a-z0-9-]+$", browser: true },
];
