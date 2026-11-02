"use client";

import { ChipToggles } from "./CertificateChips";

// Skills the student used in work, an internship or study: Python, SQL, Excel modelling… (C5). Each covers
// Skills Framework skill titles by Kaplan 360++'s mapping (lib/careers/chips.ts) and counts toward "n of m";
// internship and work counts never do.

export function SkillChips({ labelledBy, className }: { labelledBy?: string; className?: string }) {
  return <ChipToggles kind="skill" labelledBy={labelledBy} className={className} />;
}
