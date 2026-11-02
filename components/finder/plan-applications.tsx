"use client";

import { useRouter } from "next/navigation";
import { useLocalize } from "@/components/i18n/I18nProvider";
import { Board } from "@/components/workspace/board";
import type { WorkspaceProps } from "@/components/workspace/model";
import { FinderShell } from "./finder-frame";

// /plan's Applications tab: the shortlist as the application board that was a tab on /results, in /results'
// skin (data-rs-skin: the board's tokens). "Find programmes" opens the finder.

export function PlanApplications({ props }: { props: WorkspaceProps }) {
  const router = useRouter();
  const localize = useLocalize();
  return (
    <div className="ui overflow-hidden rounded-2xl border border-(--rs-line-soft) bg-card lg:h-[640px]" data-rs-skin="">
      <FinderShell props={props}>
        <Board onFind={() => router.push(localize("/results/start"))} />
      </FinderShell>
    </div>
  );
}
