// 新东方 (New Oriental) slides of Kaplan Singapore graduates' master's offers ("升学案例汇总", UCD, Northumbria and
// Murdoch degrees taken at Kaplan), each with the student's Kaplan path, GPA and an image of the offer letter. The
// site owner supplied the PDF; it was transcribed by hand on 2026-10-30, names left out, each offer linked to a
// programme id where the programme is on the site (offers for programmes the site doesn't list keep `unmatched`).
// Chosen by the agency to advertise, admits only, so the build marks them apart.
// Read from data/pipeline/xdf/cases.json by compass-build.ts.

import path from "node:path";
import { DATA_DIR } from "./config";

export const XDF_FILE = path.join(DATA_DIR, "xdf", "cases.json");

export type XdfApplication = {
  programmeId: string | null;
  /** The offer as the slide gives it, when the site doesn't list the programme. */
  unmatched?: string;
  result: "admit";
  /** The offer letter's date, when the image shows it. */
  letterDate: string | null;
  /** YYYY-MM of the start. */
  intake?: string;
};
export type XdfCase = {
  id: string;
  /** The Kaplan degree's id (data/raw/kaplan-programmes.json). */
  degree: string;
  gpa: number | null;
  gpaScale?: number;
  applications: XdfApplication[];
};

/** The report's date: the letter's date, else the first day of the intake. */
export const xdfDate = (x: XdfApplication) => x.letterDate ?? (x.intake ? `${x.intake}-01` : null);
