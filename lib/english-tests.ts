import type { EnglishTest } from "@/lib/plan-storage";

/** The English tests a student can give, with each scale (for score choices). */
export const TESTS: { value: EnglishTest; label: string; short: string; min?: number; max?: number; step?: number; start?: number }[] = [
  { value: "ielts", label: "IELTS Academic", short: "IELTS", min: 4, max: 9, step: 0.5, start: 6.5 },
  { value: "toefl", label: "TOEFL iBT", short: "TOEFL iBT", min: 0, max: 120, step: 1, start: 90 },
  { value: "pte", label: "PTE Academic", short: "PTE", min: 10, max: 90, step: 1, start: 58 },
  { value: "duolingo", label: "Duolingo English Test", short: "Duolingo", min: 10, max: 160, step: 5, start: 115 },
  { value: "none", label: "Not taken yet", short: "Not yet" },
];
