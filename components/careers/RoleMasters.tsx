import { cn } from "cn";
import { DRAFT } from "@/content/draft";
import type { RoleCardData, StudentContext } from "@/lib/careers/types";
import { getRoleMasterOptions } from "@/lib/data/careers-db";
import { getT } from "@/lib/i18n/server";
import { RoleMastersPicks } from "./RoleMastersPicks";

// The role page's master's (plan F, Q22–Q24, Q26–Q30, Q36–Q38). Server shell: the role's master's options
// (lib/data/careers-db getRoleMasterOptions: every master's of the industry's disciplines that adds one of the
// role's key skills), then the student-dependent part on the client (RoleMastersPicks): the three master's
// lib/careers/masters picks for this student, ranked by match, never by partnership. No section when no
// master's adds a key skill.

const C = DRAFT.careers;

const H2 = "m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,34px)] leading-[1.12] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

export async function RoleMasters({ role, ctx, className }: { role: RoleCardData; ctx: StudentContext; className?: string }) {
  const options = await getRoleMasterOptions(role.id);
  if (options.length === 0) return null;
  const t = await getT();
  // Only what the match reads goes to the client, not the whole role.
  const input = { industryId: role.industryId, track: role.track, keySkills: role.keySkills };

  return (
    <section aria-labelledby="cr-masters-title" className={cn("home-wrap flex flex-col gap-6 border-t border-(--land-line) py-12 sm:py-14", className)}>
      <h2 id="cr-masters-title" className={H2}>
        {t(C.role.mastersTitle)}
      </h2>
      <RoleMastersPicks role={input} ctx={ctx} options={options} />
    </section>
  );
}
