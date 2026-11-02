import { msg } from "@/lib/i18n/translate";
import type { SgStatus } from "@/lib/plan-storage";

/** Status in Singapore, as /profile and /plan ask it (lib/plan-storage.ts statusPatch keeps `status` along with it). */
export const SG_STATUSES: { value: SgStatus; label: string }[] = [
  { value: "citizen", label: msg("Citizen") },
  { value: "pr", label: msg("Permanent resident") },
  { value: "student-pass", label: msg("Student’s Pass") },
  { value: "other-pass", label: msg("Other pass") },
];
