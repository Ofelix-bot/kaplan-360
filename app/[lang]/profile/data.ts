import "server-only";
import topups from "@/data/raw/topups.json";
import type { ProfileData } from "@/components/profile/ProfileApp";
import { getKaplanAwarders } from "@/lib/data/partners";
import { getRoleKeys, getStudentContext } from "@/lib/data/careers-db";
import { degreeSkillsOf } from "@/lib/careers/pack";
import { DISCIPLINES, OTHER_SCHOOLS } from "@/lib/data/plan-options";

// What /profile needs, sliced on the server: the 56 degrees for the picker, each degree's electives (the
// topup list and the modules /careers links as electives: a module in either one), the Skills Framework
// skill titles for the internship and work entries, and the awarding university's country for the grade.

/** Skill chips offered by default on an entry. */
const DEFAULT_SKILLS = 16;

type TopupRaw = { kaplanId?: string | null; electiveModules?: string[] | null };

export async function getProfileData(): Promise<ProfileData> {
  const [ctx, index, awarders] = await Promise.all([getStudentContext(), getRoleKeys(), getKaplanAwarders()]);

  const electives: Record<string, string[]> = {};
  const listed = new Map((topups.programmes as unknown as TopupRaw[]).filter((p) => p.kaplanId).map((p) => [p.kaplanId!, p.electiveModules ?? []]));
  for (const d of ctx.degrees) {
    const linked = degreeSkillsOf(ctx, d.id).filter((l) => l.moduleKind === "elective").map((l) => l.module);
    const all = [...new Set([...(listed.get(d.id) ?? []), ...linked])];
    if (all.length) electives[d.id] = all;
  }

  /**
   * The key skills the hot roles in these industries ask for most (Kaplan 360++'s count: roles asking, then the
   * data's order), topped up from the industries' other roles when the hot ones ask for fewer than 16.
   */
  const topSkills = (industries: Set<string> | null) => {
    const roles = index.roles.filter((r) => !industries || industries.has(r.industryId));
    const ranked = (rs: typeof roles) => {
      const count = new Map<number, number>();
      for (const r of rs) for (const [s] of r.keys) count.set(s, (count.get(s) ?? 0) + 1);
      return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([s]) => index.skills[s]);
    };
    return [...new Set([...ranked(roles.filter((r) => r.hot)), ...ranked(roles)])].slice(0, DEFAULT_SKILLS);
  };
  const skillsByDegree: Record<string, string[]> = {};
  for (const d of ctx.degrees) {
    const industries = new Set(ctx.links.filter((l) => l.programmeId === d.id).map((l) => l.industryId));
    if (industries.size) skillsByDegree[d.id] = topSkills(industries);
  }

  return {
    degrees: ctx.degrees,
    electives,
    skillsByDegree,
    topSkills: topSkills(null),
    allSkills: [...index.skills].sort((a, b) => a.localeCompare(b)),
    countries: Object.fromEntries(Object.entries(awarders).map(([id, a]) => [id, a.country])),
    schools: OTHER_SCHOOLS,
    disciplines: DISCIPLINES,
  };
}
