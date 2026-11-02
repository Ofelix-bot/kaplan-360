// Responsible AI: wording the site never uses, in its own text or in anything Claude drafts.
// Kaplan 360++ compares a student's answers with published minimums; it never predicts or promises
// an admission decision. Claude-drafted text (benefit checklists, "How should I prepare?") is
// checked against this list at build time and a matching sentence is dropped; `npm run check:rai`
// scans the site's own source for the same wording.

export const BANNED_WORDING: { pattern: RegExp; why: string }[] = [
  { pattern: /\b(chance|chances|likelihood|probability|odds)\b[^.]{0,40}\b(admi|accept|offer|get in|succe)/i, why: "admission probability" },
  // Said to the student about a decision ("you will be admitted", "you'll get in"), not a rule the page states.
  { pattern: /\byou('ll| will| would| are| should)?\b[^.]{0,20}\b(get in|be admitted|be accepted|get an offer|receive an offer|be offered a place)\b/i, why: "promises admission" },
  { pattern: /\byou (can(no|')?t|cannot|can|will not|won't) (get in|be admitted|be accepted)\b/i, why: "admission verdict" },
  { pattern: /\b(will|would) (be )?(admit|accept)(ed)? you\b/i, why: "predicts a decision" },
  // "not guaranteed" and "no guarantee" are caveats, which are fine.
  { pattern: /(?<!\bnot |\bno )\bguarantee[ds]?\b/i, why: "guarantee" },
  // A verdict, not "check whether you are eligible".
  { pattern: /(?<!\b(if|whether) )\byou('re| are) (not )?(eligible|ineligible|qualified|unqualified)\b/i, why: "eligibility verdict" },
  { pattern: /\b(safe|reach|match) (school|programme|program|choice)\b/i, why: "admission banding" },
  { pattern: /\b(strong|weak|good|poor) (fit|candidate|applicant)\b/i, why: "judges the applicant" },
  { pattern: /\b(easy|hard|difficult) to get (in|into)\b/i, why: "admission difficulty" },
];

/** The first banned phrase in a text, or null. */
export function bannedWording(text: string): { match: string; why: string } | null {
  for (const b of BANNED_WORDING) {
    const m = b.pattern.exec(text);
    if (m) return { match: m[0], why: b.why };
  }
  return null;
}
