import type { PlanLevel } from "@/lib/plan-storage";

// Options the planner offers: Kaplan programmes (lib/data/plan-options.ts builds them) and other private schools.

export type KaplanProgrammeOption = { id: string; name: string; level: PlanLevel; discipline: string; university: string | null };

export type SchoolOption = { id: string; name: string };
