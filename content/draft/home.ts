import { msg } from "@/lib/i18n/translate";

// DRAFT — edit here. The homepage (components/landing/home). Owned by phase B.
// Every string goes through msg() from "@/lib/i18n/translate" so scripts/i18n/extract.mjs collects it.
// Dates ({date}) are filled from data and formatted for the page's language; never write one here.

export const home = {
  /** What each bento tile says when it opens (hover, focus; shown from the start on touch). */
  hover: {
    receipt: msg("Each figure carries a receipt: the exact sentence on the official page it came from. Open it, then check the official page yourself before you apply."),
    ai: msg("Claude picks out fees, entry requirements, deadlines and job openings. Every value is checked word for word against its page, and dropped if it isn’t there."),
    /** {date}: the last refresh (lib/changes.ts). */
    analysis: msg("Read, picked out, matched against its page; anything the page doesn’t say is dropped. Last full read: {date}."),
    look: msg("Master’s, work or a year to breathe. The paths that keep the most options open come first."),
    scoring: msg("See how hard each one is to get into, side by side. Start with Arjun’s example, then try it with your own answers."),
    privacy: msg("Nothing you enter in Start planning is sent anywhere. The one exception is “Fill in the form for me”: the sentence you choose to send goes to Claude to fill in your answers, and Kaplan 360++ doesn’t keep it."),
    /** {date}: transcribedAt in data/raw/cscse-sg-2026-09.json. */
    person: msg("China’s CSCSE certifies overseas degrees, but Kaplan 360++’s pipeline can’t read its website. So a person read its list of Singapore private schools and copied it over by hand on {date}."),
    thinking: msg("Why ReFly.X built Kaplan 360++, and how every option is verified."),
    /** The first tile (2026-11-02): the line under /move's hero. */
    problem: msg("How Kaplan 360++ works, and how every option is verified."),
    /** {observed}: the programmes whose curve rests on 5+ reported admits (data/raw/admit-model.json counts). */
    core: msg("Your result goes on one 4-point scale, adjusted for the university that awards your degree, then work, internships and test scores are added. Each programme has its own curve: from the grades of the students it admitted where 5 or more are reported ({observed} programmes), otherwise predicted from its ranking, subject and entry rules. Under 30% is a gap to close, 30–60% in range, above 60% a strong position."),
    grads: msg("Kaplan diploma and degree graduates in Singapore, cumulative, as Kaplan has published them."),
  },
  /** The small line under a tile's text, for the tiles whose title is our own count. */
  caption: {
    /** {date}: the last refresh (lib/changes.ts). */
    analysis: msg("Scholarship and deadline pages · read {date} · our own count"),
    /** {date}: the newest last_verified among the counted programmes. */
    scoring: msg("Kaplan 360++’s own count · programme pages checked up to {date}"),
  },
  /** Each tile's link, as on the reference board. */
  cta: {
    ai: msg("Read the declaration"),
    analysis: msg("See the sources"),
    look: msg("Open Next steps with our example"),
    scoring: msg("Open Programme finder"),
    /** The board's label was "Start planning"; this tile links to /declaration#answers, so it says where it goes. */
    privacy: msg("See how your answers are handled"),
    person: msg("See how it’s built"),
    thinking: msg("Read the full story"),
    core: msg("See your match rates"),
  },
  /** Words inside the tiles' pictures. */
  visual: {
    statLabel: msg("EP minimum qualifying salary"),
    matched: msg("Matched word for word"),
    fees: msg("Fees"),
    entry: msg("Entry requirements"),
    deadlines: msg("Deadlines"),
    notOnPage: msg("Not on the page"),
    read: msg("Read"),
    pick: msg("Pick out"),
    match: msg("Match"),
    drop: msg("Drop"),
    sentence: msg("1 sentence"),
    /** Short forms of the Opener's messages (content/landing.en.ts OPENER). */
    mum: msg("Have you decided about the master’s yet?"),
    kelvin: msg("Decided on a country yet?"),
    daniel: msg("Full-time roles, or a master’s first?"),
    /** The core algorithm's picture (tiles/CoreVisual.tsx): what goes in, and the worked example's result. */
    inputs: [msg("Your grades"), msg("Awarding university"), msg("Work and internships"), msg("IELTS · GRE · GMAT")],
    matchRate: msg("Match rate"),
    /** The bands, as Programme finder names them (components/finder/match-rate.tsx). */
    bands: { gap: msg("Gap to close"), range: msg("In range"), strong: msg("Strong position") },
    /** Arjun's master's in 02 Bring it together. */
    example: msg("Arjun · Bristol · MSc Management (Sustainability)"),
    /** {admits}, {programmes}: reported admits and the programmes they are linked to (data/raw/admit-cases.json). */
    admits: msg("{admits} reported admits on {programmes} programmes · the rest predicted from ranking, subject and entry rules"),
    /** {n} every page and API read and {date} the latest (lib/read-count.ts), under How AI is used's picture. */
    reads: msg("{n} pages and API reads · last read {date}"),
  },
};
