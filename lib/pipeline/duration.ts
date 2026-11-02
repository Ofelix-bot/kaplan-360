// Reads a full-time programme length in months from the duration text quoted from an official page,
// e.g. "12 months", "1 year", "Full-time (1.5 year)", "two years of full-time study". Returns null
// when the text doesn't give a length.

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3 };

const WORD_MONTHS: Record<string, number> = { nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, sixteen: 16, eighteen: 18, "twenty-four": 24 };

/** The length stated first wins: "a full-time 1 year course … the first 9 months are taught" is 12. */
export function parseDurationMonths(text: string | null): number | null {
  if (!text) return null;
  const found: [number, number][] = [];
  const add = (re: RegExp, value: (m: RegExpExecArray) => number) => {
    const m = re.exec(text);
    if (m) found.push([m.index, value(m)]);
  };
  add(/(\d+(?:\.\d+)?)\s*months?/i, (m) => Number(m[1]));
  add(/(\d+(?:\.\d+)?)[\s-]*(?:years?|yrs?)\b/i, (m) => Math.round(Number(m[1]) * 12));
  add(/\b(one|two|three)[\s-]+(?:academic\s+)?years?\b/i, (m) => WORDS[m[1].toLowerCase()] * 12);
  add(/\b(nine|ten|eleven|twelve|fifteen|sixteen|eighteen|twenty-four)[\s-]+months?\b/i, (m) => WORD_MONTHS[m[1].toLowerCase()]);
  found.sort((a, b) => a[0] - b[0]);
  return found.length ? found[0][1] : null;
}
