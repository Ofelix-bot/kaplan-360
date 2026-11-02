import { msg } from "@/lib/i18n/translate";

// DRAFT — edit here. The worked-example banner and example mode (phase D).
// Every string goes through msg() from "@/lib/i18n/translate" so scripts/i18n/extract.mjs collects it.

export const example = {
  /** {name} is the example student's name (bold), {now} who they are, briefly (lib/personas.ts `who`). */
  line: msg("You’re viewing an example: <b>{name}</b>, {now}."),
  /** Closes the example and stays on the page: the visitor's own answers (or the page's empty state) come back. */
  own: msg("Use my own details"),
  /** Closes the example, then goes to the homepage hero (/#start). */
  flow: msg("Follow the full flow"),
  /** The banner's accessible name. */
  label: msg("Worked example"),
};
