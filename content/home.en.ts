import { msg } from "@/lib/i18n/translate";

// The homepage (/): the hero's new lines and the "Why Kaplan 360++" bento (components/landing/home).
// Labels and titles as the brief has them (§4.2); a title with a figure has a {n} filled from data.
// The hover texts and the CTA labels are drafts, in content/draft/home.ts. The slogan
// "360° clarity. One defining leap." is not a message: it stays English on every page.

export const HOME = {
  hero: {
    /** Over the hero's button (2026-11-02 board). */
    start: msg("Not sure where to start?"),
    /** {n} every page and API read and {date} the latest (lib/read-count.ts); <a> links to /declaration#built. */
    reads: msg("{n} pages and API reads · last read {date} · <a>Kaplan 360++’s own count</a>"),
  },
  bento: {
    title: msg("Why Kaplan 360++"),
    more: msg("Read the full story"),
  },
  tiles: {
    receipt: { label: msg("Why it’s different"), title: msg("Every number has a source.") },
    ai: { label: msg("How AI is used"), title: msg("Claude reads the pages. If the official page doesn’t say it, nothing gets invented.") },
    /** {n} from lib/changes.ts. */
    analysis: { label: msg("The analysis"), title: msg("{n} official pages read, every value matched word for word."), titleNone: msg("Official pages read, every value matched word for word.") },
    look: { label: msg("Every option"), title: msg("See every door your degree opens.") },
    /** {n} from getProgrammeCount() (lib/data/results.ts). */
    scoring: { label: msg("Programme scoring"), title: msg("{n} programmes, scored on one scale."), titleNone: msg("Every programme, scored on one scale.") },
    privacy: { label: msg("Your privacy"), title: msg("Your answers stay in your browser.") },
    person: { label: msg("Checked by a person"), title: msg("Where a machine can’t read, a person does.") },
    thinking: { label: msg("Behind Kaplan 360++"), title: msg("Everyone’s asking what’s next. Few help you see your options.") },
    /** The first tile, across the grid (2026-11-02): the problem, the three things it answers, the chats. */
    problem: {
      label: msg("The problem it solves"),
      items: [
        { q: msg("Not sure where your degree leads?"), a: msg("See the industries and roles it opens up.") },
        { q: msg("Too many programmes to compare?"), a: msg("See how hard each one is to get into.") },
        { q: msg("Rules buried in official pages?"), a: msg("Every figure comes with its official source.") },
      ],
    },
    /** The core algorithm: the match rate (lib/admit-model.ts). */
    core: { label: msg("The core algorithm"), title: msg("One match rate per programme, built from real admits.") },
    /** Kaplan's graduates, cumulative (the chart from /move's Who it's for; words in content/move.en.ts WHO). */
    grads: { label: msg("Who it’s for") },
  },
};
