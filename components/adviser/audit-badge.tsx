"use client";

import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { Spinner } from "@/components/workspace/spinner";
import type { Verdict } from "@/lib/agent/types";
import type { Phase } from "./use-adviser";

// The audit's state on top of Step 3 (Make It Fail): a second AI checking N claims, all N checked against the official
// source, or the blocked claims with the official quote while the judge rewrites.

export function AuditBadge({ phase, checking, checked, blocked }: { phase: Phase; checking: number; checked: number | null; blocked: Verdict[] }) {
  const t = useT();
  return (
    <div className="space-y-2">
      {!!blocked.length && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-destructive">
            <ShieldAlertIcon className="size-4" aria-hidden />
            {t("Blocked by a second AI: these lines don’t match the official text")}
          </p>
          <ul className="space-y-2">
            {blocked.map((v, i) => (
              <li key={i}>
                <p className="line-through decoration-destructive/60">{v.claim}</p>
                {v.quote && (
                  <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">
                    “{v.quote}”{" "}
                    {v.url && (
                      <a className="underline" href={v.url} target="_blank" rel="noopener noreferrer">
                        {t("Source")}
                      </a>
                    )}
                  </blockquote>
                )}
                {v.note && <p className="mt-1 text-xs text-muted-foreground">{v.note}</p>}
              </li>
            ))}
          </ul>
          {phase === "rewriting" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium">
              <Spinner className="size-3.5" /> {t("Rewriting")}
            </p>
          )}
        </div>
      )}
      {phase === "rewriting" && !blocked.length && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Spinner className="size-3.5" /> {t("Rewriting")}
        </p>
      )}
      {phase === "auditing" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <Spinner className="size-3.5" /> {t("A second AI is checking {n} claims", { n: checking })}
        </p>
      )}
      {phase === "done" && checked !== null && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          <ShieldCheckIcon className="size-4" aria-hidden />
          {t("All {n} claims checked against the official source", { n: checked })}
        </p>
      )}
    </div>
  );
}
