import { create } from "zustand";

// The calculator's settings on /algorithm, shared by the calculator and step 4's range chart. Kept on the page
// only: nothing here is saved or sent, and the visitor's own planner answers are left as they are.

export type CalcState = {
  programmeId: string;
  /** The Kaplan degree's awarding university (by name, as /data/programmes lists it). */
  awarder: string;
  /** The result on the UK mark scale (40 Third … 70+ First). */
  mark: number;
  ielts: number | null;
  gre: number | null;
  /** Internships in the degree's field (0–3; the career value counts the best three). */
  internships: number;
  workYears: number;
  set: (patch: Partial<Omit<CalcState, "set">>) => void;
};

export const DEFAULT_PROGRAMME = "university-of-bristol-msc-management-sustainability";

export const useCalc = create<CalcState>()((set) => ({
  programmeId: DEFAULT_PROGRAMME,
  awarder: "University College Dublin",
  mark: 65,
  ielts: 7,
  gre: null,
  internships: 0,
  workYears: 0,
  set: (patch) => set(patch),
}));
