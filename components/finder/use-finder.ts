"use client";

import { useMemo } from "react";
import { studyCountry, type Row } from "@/components/results/facets";
import { useModel } from "@/components/workspace/model";
import { finderOf, inScope } from "@/lib/finder/answers";
import { criteriaOf, sortByCriteria, type Criterion } from "@/lib/finder/criteria";
import type { Match } from "@/lib/admit-model";
import { englishState, gradeState, hardMiss, matchInput, rowMatch, workState, type HardMiss, type State } from "@/lib/finder/row-state";
import { useWorkspace } from "@/lib/workspace/store";

// The finder's list: every programme in the student's directions, fee band and regions whose minimum their
// result meets (a programme under it is left out, as on /results) and whose fixed requirements they meet
// (lib/finder/row-state.ts hardMiss; those are counted, by reason), each with its pills and match rate, in the order chosen
// (lib/finder/criteria.ts). The Kaplan tab keeps only the master's taught at Kaplan Singapore, by the same rules.

export type FinderRow = Row & { grade: State; english: State; work: State; match: Match | null };
export type FinderTab = "all" | "kaplan";

export const MAX_COMPARE = 4;

/** `only` holds the list to one tab whatever the student last picked (the parents page shows every programme). */
export function useFinderList(only?: FinderTab): {
  list: FinderRow[];
  left: Record<HardMiss, number>;
  counts: Record<FinderTab, number>;
  criteria: Criterion[];
  setCriteria: (c: Criterion[]) => void;
  tab: FinderTab;
  setTab: (t: FinderTab) => void;
} {
  const m = useModel();
  const criteria = criteriaOf(useWorkspace((s) => s.finderSort));
  const kept = useWorkspace((s) => s.finderTab);
  const tab: FinderTab = only ?? (kept === "kaplan" ? "kaplan" : "all");
  const f = finderOf(m.answers);
  const a = m.answers;
  const key = JSON.stringify([f.directions, f.fee, f.regions, criteria, tab, a.englishTest, a.englishScore, a.workYears, a.workExperience, a.status, a.gre, a.gmat, a.internshipsSame, a.internshipsOther, m.university]);
  const { list, left, counts } = useMemo(() => {
    const out: FinderRow[] = [];
    const left: Record<HardMiss, number> = { "part-time": 0, work: 0, english: 0 };
    const counts: Record<FinderTab, number> = { all: 0, kaplan: 0 };
    const awarderQs = m.university ? (m.data.universities.find((u) => u.name === m.university)?.qsValue ?? null) : null;
    const input = matchInput(m.you, m.youCases?.gpa ?? null, awarderQs, m.answers);
    for (const r of m.rows) {
      if (r.s === "below" || !inScope(r.p, studyCountry(r), f)) continue;
      const here = tab === "all" || r.p.kaplan;
      const miss = hardMiss(r, m.answers);
      if (miss) {
        if (here) left[miss]++;
        continue;
      }
      counts.all++;
      if (r.p.kaplan) counts.kaplan++;
      if (here) out.push({ ...r, grade: gradeState(r, m.you), english: englishState(r, m.answers), work: workState(r, m.answers), match: rowMatch(r, m.data.match, input) });
    }
    sortByCriteria(out, criteria);
    return { list: out, left, counts };
    // `f`, the criteria and the answers enter through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.rows, m.you, m.youCases, m.data, key]);
  return {
    list,
    left,
    counts,
    criteria,
    setCriteria: (finderSort) => useWorkspace.setState({ finderSort: criteriaOf(finderSort), savedAt: Date.now() }),
    tab,
    setTab: (finderTab) => useWorkspace.setState({ finderTab, savedAt: Date.now() }),
  };
}
