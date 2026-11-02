// Official pages for the planner's dates (scripts/plan/dates.ts): Kaplan's programme previews, and
// each university's Singapore page, postgraduate open days or webinars, and application dates.
// Found from each site's sitemap on 2026-10-20 (scripts/plan/find-pages.ts). Universities whose
// sitemap gave no such page (Murdoch, LSE, Glasgow, Melbourne, UNSW, Queensland, Trinity, NTU,
// Sydney, Warwick, Edinburgh, Bristol, UCL) are left out rather than guessed.

export type DateSource = {
  institutionId: string;
  pages: string[];
  browser?: boolean;
  /** Added to the reader's instructions for this source's pages. */
  hint?: string;
};

export const PLAN_SOURCES: DateSource[] = [
  // The preview list pages by 12; three pages covered every upcoming preview on 2026-10-20.
  {
    institutionId: "kaplan",
    pages: ["https://www.kaplan.com.sg/programme-preview/all/all/all", "https://www.kaplan.com.sg/programme-preview/all/all/all?page=1", "https://www.kaplan.com.sg/programme-preview/all/all/all?page=2"],
    hint: "This is Kaplan Singapore's list of programme previews, held in Singapore: list every preview on it (bachelor's and master's alike) as an event, with its date.",
  },
  {
    institutionId: "university-college-dublin",
    pages: ["https://www.ucd.ie/global/meet-us/", "https://www.ucd.ie/global/study-at-ucd/singapore/"],
    browser: true,
  },
  {
    institutionId: "northumbria-university-at-newcastle",
    pages: [
      "https://www.northumbria.ac.uk/international/northumbria-and-your-country/asia/singapore/",
      "https://www.northumbria.ac.uk/international/meet-us-in-your-country/",
      "https://www.northumbria.ac.uk/study-at-northumbria/admissions/application-deadlines-and-key-dates/",
      "https://www.northumbria.ac.uk/study-at-northumbria/postgraduate-study/northumbria-masters-open-day/",
    ],
  },
  { institutionId: "birmingham-city-university", pages: ["https://www.bcu.ac.uk/international/bcu-in-your-country/singapore"] },
  { institutionId: "university-of-portsmouth", pages: ["https://www.port.ac.uk/postgraduate-virtual-event", "https://www.port.ac.uk/study/open-days"] },
  { institutionId: "aston-university", pages: ["https://www.aston.ac.uk/open-days/postgraduate", "https://www.aston.ac.uk/postgraduate/webinar-series"] },
  {
    institutionId: "imperial-college-london",
    pages: ["https://www.imperial.ac.uk/about/global/singapore/", "https://www.imperial.ac.uk/events/masters-open-day/", "https://www.imperial.ac.uk/business-school/programmes/meet-us/"],
  },
  { institutionId: "king-s-college-london", pages: ["https://www.kcl.ac.uk/study/postgraduate-taught/events/virtual-open-events"] },
  {
    institutionId: "university-of-manchester",
    pages: ["https://www.manchester.ac.uk/study/masters/meet-us/masters-information-sessions/", "https://www.manchester.ac.uk/study/international/country-specific-information/singapore/"],
  },
  { institutionId: "university-of-leeds", pages: ["https://www.leeds.ac.uk/pg-virtual-open-day", "https://www.leeds.ac.uk/pgopenday"] },
  {
    institutionId: "university-of-sheffield",
    pages: ["https://www.sheffield.ac.uk/postgraduate/deadlines", "https://www.sheffield.ac.uk/international/singapore", "https://www.sheffield.ac.uk/postgraduate/visit/open-day"],
  },
  { institutionId: "university-of-southampton", pages: ["https://www.southampton.ac.uk/open-days/postgraduate", "https://www.southampton.ac.uk/international/meet-us-in-your-country"] },
  { institutionId: "rmit-university", pages: ["https://www.rmit.edu.au/study-with-us/international-students/singapore-enquire"] },

  // Guessed from each site's usual URL patterns (the user asked for this on 2026-10-20, as these
  // sitemaps gave no page). A guess that doesn't exist is logged as a failed page, nothing more.
  { institutionId: "murdoch-university", pages: ["https://www.murdoch.edu.au/study/events", "https://www.murdoch.edu.au/events"] },
  {
    institutionId: "london-school-of-economics-and-political-science",
    pages: ["https://www.lse.ac.uk/study-at-lse/Graduate/How-to-apply/Application-deadlines", "https://www.lse.ac.uk/study-at-lse/Graduate/events-and-visits"],
  },
  { institutionId: "university-of-glasgow", pages: ["https://www.gla.ac.uk/international/country/singapore/", "https://www.gla.ac.uk/international/events/"] },
  { institutionId: "university-of-melbourne", pages: ["https://study.unimelb.edu.au/connect-with-us/events", "https://study.unimelb.edu.au/how-to-apply/key-dates"] },
  { institutionId: "university-of-new-south-wales", pages: ["https://www.unsw.edu.au/study/international-students/events", "https://www.unsw.edu.au/study/how-to-apply/key-dates"] },
  { institutionId: "university-of-queensland", pages: ["https://study.uq.edu.au/events", "https://study.uq.edu.au/admissions/key-dates"] },
  {
    institutionId: "trinity-college-dublin-the-university-of-dublin",
    pages: ["https://www.tcd.ie/study/international/events/", "https://www.tcd.ie/study/international/country/singapore/", "https://www.tcd.ie/courses/postgraduate/apply/closing-dates/"],
  },
  {
    institutionId: "university-of-sydney",
    pages: ["https://www.sydney.edu.au/study/events-and-open-days.html", "https://www.sydney.edu.au/study/how-to-apply/postgraduate-coursework/key-dates.html"],
  },
  {
    institutionId: "university-of-warwick",
    pages: ["https://warwick.ac.uk/study/postgraduate/apply/deadlines/", "https://warwick.ac.uk/study/postgraduate/visits/", "https://warwick.ac.uk/study/international/countryinformation/asia/singapore/"],
  },
  { institutionId: "university-of-edinburgh", pages: ["https://www.ed.ac.uk/studying/postgraduate/events", "https://www.ed.ac.uk/studying/postgraduate/applying/deadlines"] },
  { institutionId: "university-of-bristol", pages: ["https://www.bristol.ac.uk/study/postgraduate/visits-and-events/", "https://www.bristol.ac.uk/international/countries/singapore.html"] },
  { institutionId: "ucl", pages: ["https://www.ucl.ac.uk/prospective-students/graduate/events", "https://www.ucl.ac.uk/prospective-students/graduate/apply/application-dates"] },
  // Hong Kong, Macau and Singapore (the primary master's reference from 2026-10-20): admissions,
  // application-period and info-session pages found by web search on 2026-10-20, plus a few guesses.
  { institutionId: "university-of-hong-kong", pages: ["https://portal.hku.hk/tpg-admissions/applying", "https://portal.hku.hk/tpg-admissions/events", "https://mscadmissions.engg.hku.hk/?p=379"], browser: true },
  {
    institutionId: "chinese-university-of-hong-kong",
    pages: ["https://www.gs.cuhk.edu.hk/admissions/overseas-admission-events", "https://www.gs.cuhk.edu.hk/admissions/admissions/how-to-apply", "https://www.law.cuhk.edu.hk/app/cuhk-law-postgraduate-information-day-2026/"],
  },
  { institutionId: "hong-kong-university-of-science-and-technology", pages: ["https://fytgs.hkust.edu.hk/info-session", "https://pg.ust.hk/", "https://science.hkust.edu.hk/node/7796"], browser: true },
  {
    institutionId: "hong-kong-polytechnic-university",
    pages: [
      "https://www.polyu.edu.hk/study/pg/news/polyu-taught-postgraduate-programmes-applications-open-202728",
      "https://www.polyu.edu.hk/study/pg/news/now-open-apply-2027-taught-postgraduate-programmes",
      "https://www.polyu.edu.hk/study/pg/taught-postgraduate/subject-based-admission-tpg",
    ],
    browser: true,
  },
  { institutionId: "city-university-of-hong-kong", pages: ["https://www.cityu.edu.hk/en/pg/news-and-events/information-session", "https://www.cityu.edu.hk/en/pg/taught-postgraduate-programmes/faq"], browser: true },
  { institutionId: "hong-kong-baptist-university", pages: ["https://bus.hkbu.edu.hk/news-events/upcoming-events/2026/TPg-Online-Info-Session.html", "https://ar.hkbu.edu.hk/tpg-admissions/programmes"] },
  { institutionId: "lingnan-university-hong-kong", pages: ["https://ln.edu.hk/mgt/prog/application", "https://www.ln.edu.hk/sgs/taught-postgraduate-programmes"] },
  { institutionId: "education-university-of-hong-kong", pages: ["https://www.eduhk.hk/acadprog/postgrad/index.html", "https://www.eduhk.hk/gradsch/pg_prospective/coming-soon.html"] },
  { institutionId: "hong-kong-metropolitan-university", pages: ["https://admissions.hkmu.edu.hk/tpg/", "https://pg-pt-infoday.hkmu.edu.hk/"], browser: true },
  { institutionId: "hang-seng-university-of-hong-kong", pages: ["https://gs.hsu.edu.hk/en/programmes-on-offer-2/", "https://gs.hsu.edu.hk/en/programmes-on-offer/"] },
  { institutionId: "hong-kong-shue-yan-university", pages: ["https://gs.hksyu.edu/en/Prospective-Students/Application", "https://gs.hksyu.edu/en/Programmes/TaughtMasterProgramme"] },
  { institutionId: "university-of-macau", pages: ["https://grs.um.edu.mo/index.php/prospective-students/master-postgraduate-certificate-diploma-programmes", "https://grs.um.edu.mo/?p=1977"] },
  { institutionId: "macau-university-of-science-and-technology", pages: ["https://www.must.edu.mo/en/sgs/admission/master"], browser: true },
  { institutionId: "macao-polytechnic-university", pages: ["https://mpusite.mpu.edu.mo/admission_overseas/en/pg_admission_rules.php", "https://mpusite.mpu.edu.mo/postgraduate/en/master_list.php"], browser: true },
  { institutionId: "macao-university-of-tourism", pages: ["https://www.utm.edu.mo/en/admission/postgraduate", "https://www.utm.edu.mo/shm/en/programmes/postgraduate-programmes/index.html"] },
  {
    institutionId: "national-university-of-singapore",
    pages: [
      "https://fass.nus.edu.sg/prospective-students/graduate/coursework-programmes/application-process-gradcoursework/",
      "https://mscstrategy.nus.edu.sg/admissions/application-process/",
      "https://www.comp.nus.edu.sg/graduate/",
      "https://law.nus.edu.sg/prospective-students/",
      "https://masters.nus.edu.sg/events-all",
    ],
    browser: true,
  },
  {
    institutionId: "nanyang-technological-university-singapore",
    pages: ["https://www.ntu.edu.sg/admissions/graduate/cwadmissionguide", "https://www.ntu.edu.sg/admissions/graduate/events", "https://www.ntu.edu.sg/business/admissions/graduate-studies"],
    browser: true,
  },
  {
    institutionId: "singapore-management-university",
    pages: ["https://www.trumba.com/events-calendar/smu/events/smu_lkcsb_mm_infosess", "https://masters.smu.edu.sg/events", "https://masters.smu.edu.sg/admissions"],
    browser: true,
  },
];
