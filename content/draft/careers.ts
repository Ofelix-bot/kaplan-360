import { msg } from "@/lib/i18n/translate";

// DRAFT — edit here. Every piece of /careers UI copy that is not data (plan §3.6; build-spec.md "Copy").
// Every string goes through msg() from "@/lib/i18n/translate" so scripts/i18n/extract.mjs collects it; render
// with t() / useT(). Labels are at most 30 characters (Q13), in sentence case, never tracked or uppercase.
// Sentences are one line or two at most. No hedging words, no literal dates: dates come from the data
// ({date} is filled with useDay() or the server formatter). Industry and role names come from the data.

export const careers = {
  meta: {
    /** <title> of /careers: "{this} · Kaplan 360++" (the site's existing metadata pattern). */
    title: msg("Career Compass"),
    description: msg("Pick your Kaplan degree. See the Singapore industries it leads to, the roles in demand, and how you match."),
    /** {industry} is the industry's short name. */
    industryDescription: msg("{industry} in Singapore: four figures with receipts, the roles in demand, and how you match."),
    /** {role} is the role's short title. */
    roleDescription: msg("{role} in Singapore: pay, demand, key skills, and how you close the gap."),
  },

  entry: {
    /** The entry page's only H1. Short. */
    h1: msg("Where your degree can take you"),
    /** Section titles, each led by a visual. */
    mapTitle: msg("Your degree, by industry"),
    gridTitle: msg("All 16 industries"),
    /** On the student's own industry cards in IndustryGrid. */
    yours: msg("Your degree leads here"),
    /** {n} hot roles in the industry (Kaplan 360++'s count); the One form when n is 1. */
    hotCount: msg("{n} hot roles"),
    hotCountOne: msg("1 hot role"),
    /** {n} entry and early-career roles in the industry. */
    roleCount: msg("{n} roles for graduates"),
    roleCountOne: msg("1 role for graduates"),
    /** Beside the graduate roles on a degree-map card whose industry has no hot role. */
    noHot: msg("No hot roles yet"),
    /** Visitors with no degree and no example open. */
    empty: msg("Pick a degree to see a match"),
    seeIndustry: msg("See the industry"),
    /** One line above the 16 industry cards: the guided flow's next step. */
    pickIndustry: msg("Pick an industry"),
  },

  picker: {
    /** The trigger, before a degree is picked. */
    pick: msg("Pick your degree"),
    change: msg("Change degree"),
    search: msg("Search degree or university"),
    none: msg("No degree matches that"),
    /** The trigger's accessible name; {degree} is the degree's name. */
    current: msg("Your degree: {degree}"),
    /** Under the list: a diploma student's choice goes into the degree they move on to. */
    diplomaNote: msg("On a diploma? Pick the degree you move on to."),
  },

  map: {
    /** On each degree → industry line. {k} shared skills. */
    shared: msg("{k} shared skills"),
    sharedOne: msg("1 shared skill"),
    /** The student's best band over ALL the industry's roles (Q2); the role and its n of m follow below it. */
    bestHigh: msg("Best match: High"),
    bestMedium: msg("Best match: Medium"),
    bestLow: msg("Best match: Low"),
    /** The diagram's accessible name; {degree} the degree, {n} industries. */
    label: msg("{degree} leads to {n} industries"),
    labelOne: msg("{degree} leads to 1 industry"),
  },

  band: {
    /** The industry dropdown's trigger name and the list's name. */
    industries: msg("Industries"),
    switchTo: msg("Switch industry"),
    /** Breadcrumb's first link. */
    all: msg("All industries"),
  },

  /** IndustryLead: the industry page's only H1, one per industry, at most two lines, no figures. Keyed by industry id. */
  leads: {
    "infocomm-technology": msg("Software, data, cybersecurity and IT infrastructure that support Singapore’s digital economy."),
    "financial-services": msg("Banking, insurance, asset management and capital markets."),
    media: msg("Film, broadcasting, publishing, games and digital content."),
    "wholesale-trade": msg("Bulk trading and distribution of goods and commodities, with Singapore as a regional hub."),
    retail: msg("Consumer sales in stores and online, from merchandising to customer service."),
    "human-resource": msg("Recruitment, compensation, talent development and employee relations within organisations."),
    accountancy: msg("Audit, tax, financial reporting and advisory services for organisations."),
    "social-service": msg("Care, counselling and support services for individuals, families and communities."),
    logistics: msg("Transport, warehousing and distribution of goods into, through and out of Singapore."),
    "early-childhood": msg("Education and care for young children before they start primary school."),
    "hotel-and-accommodation-services": msg("Hotel and accommodation operations, from guest services to housekeeping."),
    tourism: msg("Attractions, travel services and events for visitors to Singapore."),
    "built-environment": msg("Design, construction and management of Singapore’s buildings and infrastructure."),
    healthcare: msg("Medical, nursing and allied health services in hospitals, clinics and the community."),
    "intellectual-property": msg("Protection, management and commercialisation of patents, trade marks, designs and copyright."),
    "legal-services": msg("Legal advice, representation and compliance, from law firms to in-house legal teams."),
  } as Record<string, string>,

  region: {
    label: msg("Region"),
    singapore: msg("Singapore"),
    asiaPacific: msg("Asia Pacific"),
    global: msg("Global"),
    /** A disabled option's label (C3): at most 30 characters. */
    noAsiaPacific: msg("Asia Pacific (no data)"),
    noGlobal: msg("Global (no data)"),
    /** {label} is the region as the report prints it ("Southeast Asia"). */
    asPrinted: msg("Report's region: {label}"),
  },

  now: {
    /** H2 of the night band; {industry} is the industry's short name. */
    title: msg("{industry} now"),
  },

  hot: {
    title: msg("Hot roles"),
    /** {n} roles in the expanded list. */
    showAll: msg("Show all {n}"),
    showFewer: msg("Show fewer"),
    /** No hot role in the industry: the section shows the industry's other roles instead. */
    none: msg("No hot role in this industry"),
    otherRoles: msg("Other roles for graduates"),
    /** The card's CTA. */
    open: msg("See the role"),
    /** On the card face: {k} of the role's key skills you cover. */
    youHave: msg("You cover"),
    youMiss: msg("Missing"),
    /** The nearest gap action on the card. */
    nextStep: msg("Next step"),
    /** Q26's own words: "N openings · checked {date}". Shown only where checked. */
    openings: msg("{n} openings · checked {date}"),
    openingsOne: msg("1 opening · checked {date}"),
    /** Under the title (2026-11-02 board): {n} roles in the list. */
    sub: msg("{n} roles · sorted by match. Pick a role to see its gap below."),
    subOne: msg("1 role. Pick it to see its gap below."),
    /** The compact card's match line: the band, then {n}/{m} key skills. */
    cardHigh: msg("High match · {n}/{m} skills"),
    cardMedium: msg("Medium match · {n}/{m} skills"),
    cardLow: msg("Low match · {n}/{m} skills"),
    /** The "Show all" button of the compact list: {n} roles. */
    showAllRoles: msg("Show all {n} roles"),
  },

  /**
   * What a skill's level means (components/careers/SkillLevels; 2026-11-02): SWDA's general descriptors for
   * TSC proficiency levels, Responsibility column, word for word (Skills Framework for Social Service, p. 99).
   */
  levels: {
    title: msg("What the levels mean"),
    /** The pyramid's accessible name. */
    figure: msg("A six-tier pyramid of skill levels, 1 at the base and 6 at the top, which a student climbs"),
    /** {n} 1 to 6. */
    level: msg("Level {n}"),
    routine: msg("Routine"),
    lessRoutine: msg("Less routine"),
    complex: msg("Complex"),
    l6: msg("Accountable for significant area of work, strategy or overall direction"),
    l5: msg("Accountable for achieving assigned objectives, decisions made by self and others"),
    l4: msg("Hold accountability for performance of self and others"),
    l3: msg("May hold some accountability for performance of others, in addition to self"),
    l2: msg("Work with some supervision"),
    l1: msg("Work under direct supervision"),
  },

  /** The gap under the hot roles, for the role picked (components/careers/RoleGapPanel; 2026-11-02 board). */
  gapPanel: {
    /** {role} the role's short title. */
    title: msg("{role}: closing the gap"),
    details: msg("Role details"),
    /** Now {n}/{m} · after Kaplan courses {k}/{m} · {x} outside your courses. */
    line: msg("Now {n}/{m} · after Kaplan courses {k}/{m} · {x} to close outside your courses"),
    lineNoOutside: msg("Now {n}/{m} · after Kaplan courses {k}/{m}"),
    /** The column heads: {n} key skills in each. */
    have: msg("You have {n}"),
    kaplan: msg("Kaplan courses can close {n}"),
    outside: msg("Close outside your courses {n}"),
    /** A skill's Skills Framework level. */
    level: msg("Level {level}/6"),
    /** An outside skill's line: {level} its level. */
    levelNone: msg("Level {level}/6 · Your degree doesn’t cover it"),
    /** Where a covered skill comes from: {modules} the modules. */
    from: msg("From {modules}"),
    /** Under a module of the student's own degree that closes a gap. */
    ownElective: msg("An elective in your degree"),
    add: msg("Add to plan"),
    added: msg("Added to plan"),
    /** The outside skill's link (to the role page's master's). */
    find: msg("Find a master’s or certificate for this"),
    /** The closing button: {n} gaps. */
    addAll: msg("Add these {n} gaps to Your plan"),
    addAllOne: msg("Add this gap to Your plan"),
    /** No key skill missing. */
    done: msg("You cover every key skill"),
    /** A column with no skill in it. */
    none: msg("None"),
    /** The bar's accessible name: {n} have, {k} Kaplan, {x} outside, of {m}. */
    bar: msg("{n} you have, {k} Kaplan courses can close, {x} outside your courses, of {m} key skills"),
  },

  badges: {
    momNeeds: msg("MOM needs"),
    /** The badge when it rests on the COMPASS Shortage Occupation List. */
    momNeedsSol: msg("MOM needs: EP list"),
    highPay: msg("High pay"),
  },

  match: {
    high: msg("High match"),
    medium: msg("Medium match"),
    low: msg("Low match"),
    /** Always beside the band (Q11): never a probability. */
    nOfM: msg("{n} of {m} skills"),
    /** The band with n of m, as one accessible string. */
    full: msg("{band}, {n} of {m} skills"),
    fit: msg("Your field fits"),
    /** C2. */
    adjacent: msg("Adjacent field"),
    none: msg("Your field differs"),
    /** How a covered skill is backed. */
    viaModule: msg("From {module}"),
    viaCertificate: msg("From {certificate}"),
    viaSkill: msg("You ticked {skill}"),
    /** A skill ticked on an internship or work entry (/profile). */
    viaExperience: msg("From your internships and work"),
  },

  gap: {
    title: msg("Close the gap"),
    have: msg("You have"),
    asks: msg("The role asks"),
    /** The progress line: now n/m → after the listed actions n′/m. */
    now: msg("Now {n} of {m}"),
    after: msg("After these {n} of {m}"),
    /** No missing key skill. */
    done: msg("You cover every key skill"),
    /** The industry page's gap → action summary heading. */
    summary: msg("Your gaps and what closes them"),
  },

  /** The 8-cell key-skill bars (components/careers/SkillCells): one label per cell state, also the legend. */
  skillCells: {
    have: msg("You have"),
    add: msg("A Kaplan degree adds"),
    none: msg("No Kaplan degree covers"),
    /** A cell's accessible name: {skill} the key skill, {state} one of the labels above. */
    cell: msg("{skill}: {state}"),
  },

  /** The entry page's headline over every role's key skills; {share} is one of the words below. */
  gapShare: {
    headline: msg("{share} of these key skills: no Kaplan degree's core modules cover them."),
    few: msg("Few"),
    tenth: msg("About a tenth"),
    fifth: msg("About a fifth"),
    quarter: msg("About a quarter"),
    third: msg("About a third"),
    almostHalf: msg("Almost half"),
    overHalf: msg("Over half"),
    twoThirds: msg("Nearly two thirds"),
    most: msg("Most"),
  },

  actions: {
    electiveTitle: msg("An elective in your degree"),
    /** {module} the elective's name. */
    elective: msg("Take {module}"),
    /** {skills} the key skills it covers. */
    electiveCovers: msg("Covers {skills}."),
    certificateTitle: msg("A professional certificate"),
    /** {certificate} the chip label. */
    certificate: msg("Sit {certificate}"),
    /** {n} exemptions, {list} their codes (data/raw/certificates.json). */
    exemptions: msg("Exempt from {n}: {list}"),
    internshipTitle: msg("An internship"),
    /** {track} the Skills Framework track (a title only). */
    internship: msg("Intern in {track}"),
    /** {skills} the key skills to ask for. */
    internshipAsk: msg("Ask for work on {skills}."),
    /** {n} internships the student already counts. */
    internshipHave: msg("You list {n} internships"),
    internshipHaveOne: msg("You list 1 internship"),
    /** Student's Pass holders: restates mom-pass-expires. */
    pass: msg("After your Student's Pass ends, work needs a work pass."),
    /** Citizens and permanent residents. */
    noPass: msg("No work pass needed."),
    seeCourse: msg("See the course"),
  },

  you: {
    /** The one-line summary's heading (YouStrip); the details are filled in on /profile. */
    title: msg("You"),
    work: msg("Work"),
    /** {n} years of full-time work. */
    workYears: msg("{n} years"),
    workYearsOne: msg("1 year"),
  },

  role: {
    /** Breadcrumb's accessible name. */
    crumbs: msg("Breadcrumb"),
    payTitle: msg("Pay in Singapore"),
    p25: msg("25th percentile"),
    median: msg("Median"),
    p75: msg("75th percentile"),
    /** Which OWT sheet the ruler uses. {industry} is MOM's group name. */
    payIndustry: msg("Gross monthly, {industry}"),
    payAll: msg("Gross monthly, all industries"),
    advertised: msg("Advertised pay"),
    /** Under the advertised range (Jobstreet's own caveat restated). */
    advertisedNote: msg("Pay in job ads, not pay received."),
    demandTitle: msg("Demand"),
    /** Under "#{rank}" from MOM's per-industry JV 2025 list (the card's figure carries the rank). */
    jvRank: msg("Vacancy rank in its industry"),
    sol: msg("On the EP shortage list"),
    freshVacancies: msg("Vacancies for fresh graduates"),
    startPay: msg("Starting pay range"),
    skillsTitle: msg("Key skills"),
    /** {level} of 6. */
    level: msg("Level {level} of 6"),
    employersTitle: msg("Employers hiring"),
    seeOpenings: msg("See openings"),
    /** The folded row of employers checked with no opening; {n} employers. */
    noOpenings: msg("{n} checked, no opening"),
    mastersTitle: msg("Master's that lead here"),
    /** {n} master's in /results. */
    seeAll: msg("See all {n}"),
    partner: msg("Kaplan partner"),
    /** Unknown role id: the page lists industries instead. */
    missingTitle: msg("No such role"),
    missing: msg("Pick an industry to see its roles."),
  },

  /** The role page's three master's (components/careers/RoleMasters; plan F, Q36–Q38). */
  masters: {
    /** Over the role's key-skill bar: the exact count ({n} of {m}), since one role's 8 skills are too few for share words. */
    edgeShare: msg("{n} of these {m} skills: no Kaplan degree covers them."),
    edgeShareOne: msg("1 of these {m} skills: no Kaplan degree covers it."),
    edgeAll: msg("All of these skills: no Kaplan degree covers them."),
    edgeNone: msg("Every one of these skills: a Kaplan degree covers it."),
    /** "+3 → High (6 of 8)": {n} skills added, {band} the band after, {k} of {m} after. */
    result: msg("+{n} → {band} ({k} of {m})"),
    high: msg("High"),
    medium: msg("Medium"),
    low: msg("Low"),
    /** {n} key skills its core modules add. */
    core: msg("+{n} core"),
    /** {modules} the electives to pick, {n} the key skills they add. */
    pick: msg("pick {modules} for +{n}"),
    /** Slot 1's tag: {n} edge skills it adds. */
    edge: msg("Edge +{n}"),
    /** The cell states of the master's rows (components/careers/SkillCells). */
    cellMaster: msg("Master's adds"),
    cellEdge: msg("Adds an edge skill"),
    cellMissing: msg("Still missing"),
    /** A row's bar, as one accessible name: {programme}, then {k} of {m} after. */
    bar: msg("{programme}: {k} of {m} key skills after"),
    /** The official page's receipt: {programme} the programme's name. */
    page: msg("{programme}: the programme's page"),
    pageWhere: msg("Modules and outcomes"),
    compare: msg("Compare in Programme finder"),
    /** The second button, when certificates and the internship step close every missing key skill: no master's needed. */
    toPlan: msg("Add to your plan"),
  },

  /** The shared receipt UI (components/shared/receipt), used site-wide (C6). */
  receipt: {
    /** Fn's accessible name: {n} the numeral, {publisher}, {title}. */
    source: msg("Source {n}: {publisher}, {title}"),
    published: msg("Published {date}"),
    read: msg("Read {date}"),
    matched: msg("Matched word for word"),
    matchedRow: msg("Matched cell by cell"),
    pageImage: msg("Read from the page image"),
    rule: msg("Kaplan 360++'s rule"),
    reported: msg("Not the notice itself"),
    person: msg("Transcribed by a person"),
    open: msg("Open the page"),
    view: msg("View the page"),
    /** The drawer. */
    drawer: msg("Receipt"),
    notPhotographed: msg("Not photographed"),
    stepRead: msg("Read"),
    stepPicked: msg("Picked out"),
    stepMatched: msg("Matched"),
    prev: msg("Previous receipt"),
    next: msg("Next receipt"),
    /** {i} of {n} receipts in the group. */
    position: msg("{i} of {n}"),
    /** SourceList's heading (visually hidden or small). */
    sources: msg("Sources"),
    /** SourceChip: {n} sources. */
    count: msg("{n} sources"),
    countOne: msg("1 source"),
    close: msg("Close"),
  },
};
