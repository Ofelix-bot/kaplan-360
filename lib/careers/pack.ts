import type { DegreeSkill, PackedDegreeSkills, StudentContext } from "./types";

// Every /careers page hands StudentContext to the client, and its module → skill links were most of it (580 KB a
// page as objects, times three languages in the build's page cache, which made the deploy's upload time out).
// Packed, each title is sent once and a link is three numbers; a page unpacks only the degree it needs.

const ELECTIVE = 1;
const CLAUDE = 2;

/** The server side: programmeId → links, as compact rows of [skill index, module index, flags]. */
export function packDegreeSkills(bySkill: Record<string, DegreeSkill[]>): PackedDegreeSkills {
  const skills: string[] = [];
  const modules: string[] = [];
  const skillAt = new Map<string, number>();
  const moduleAt = new Map<string, number>();
  const index = (list: string[], at: Map<string, number>, s: string) => {
    let i = at.get(s);
    if (i === undefined) at.set(s, (i = list.push(s) - 1));
    return i;
  };
  let model: string | null = null;
  const rows: Record<string, number[]> = {};
  for (const [programmeId, links] of Object.entries(bySkill)) {
    const flat: number[] = [];
    for (const l of links) {
      if (l.model) model = l.model;
      flat.push(index(skills, skillAt, l.skill), index(modules, moduleAt, l.module), (l.moduleKind === "elective" ? ELECTIVE : 0) | (l.basis === "claude" ? CLAUDE : 0));
    }
    rows[programmeId] = flat;
  }
  return { skills, modules, model, rows };
}

const cache = new WeakMap<PackedDegreeSkills, Map<string, DegreeSkill[]>>();

/** One degree's links, unpacked once per context. An unknown degree has none. */
export function degreeSkillsOf(ctx: Pick<StudentContext, "degreeSkills">, programmeId: string): DegreeSkill[] {
  const packed = ctx.degreeSkills;
  let byId = cache.get(packed);
  if (!byId) cache.set(packed, (byId = new Map()));
  const hit = byId.get(programmeId);
  if (hit) return hit;
  const flat = packed.rows[programmeId] ?? [];
  const out: DegreeSkill[] = [];
  for (let i = 0; i < flat.length; i += 3) {
    const claude = (flat[i + 2] & CLAUDE) !== 0;
    out.push({
      programmeId,
      skill: packed.skills[flat[i]],
      module: packed.modules[flat[i + 1]],
      moduleKind: flat[i + 2] & ELECTIVE ? "elective" : "core",
      basis: claude ? "claude" : "rule",
      model: claude ? packed.model : null,
    });
  }
  byId.set(programmeId, out);
  return out;
}
