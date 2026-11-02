// Which collected planner dates (data/raw/plan-dates.json) a student in Singapore can use: every
// application date, and events that are online, in Singapore or with no place given, not for
// undergraduates or school students, and not in person in another city. Used by /plan and by
// scripts/changes/diff.ts. Kaplan's own previews are all in Singapore.

export function forStudentsInSingapore(d: { kind: string; institutionId: string; title: string; format: string | null }): boolean {
  if (d.kind !== "event" || d.institutionId === "kaplan") return true;
  if (d.format && !/online|virtual|singapore/i.test(d.format)) return false;
  if (/undergraduate/i.test(d.title) && !/postgraduate|master/i.test(d.title)) return false;
  if (/\byear 1[0-2]\b|high school|secondary school/i.test(d.title)) return false;
  // In person in another city: not something a student in Singapore can attend.
  return !(
    /\b(Shanghai|Beijing|Shenzhen|Guangzhou|Hangzhou|Jakarta|Ho Chi Minh|Hanoi|Seoul|Tokyo|Mumbai|Bengaluru|Bangalore|Manila|Kuala Lumpur|Bangkok|Taipei)\b/.test(d.title) &&
    !/online|virtual|webinar/i.test(d.title)
  );
}
