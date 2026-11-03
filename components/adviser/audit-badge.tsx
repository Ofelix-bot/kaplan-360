"use client";

import { useT } from "@/components/i18n/I18nProvider";
import type { Verdict } from "@/lib/agent/types";
import s from "./adviser.module.css";
import type { Phase } from "./use-adviser";

// The audit's state on top of Step 3 (Make It Fail): a badge with a square dot, amber and blinking while a second AI
// checks N claims or the judge rewrites, green once all N are checked against the official source; and while the judge
// rewrites and after, the blocked claims struck through with the official quote.

export function AuditBadge({ phase, checking, checked, blocked }: { phase: Phase; checking: number; checked: number | null; blocked: Verdict[] }) {
  const t = useT();
  const badge =
    phase === "auditing"
      ? { s: "checking", text: t("A second AI is checking {n} claims", { n: checking }) }
      : phase === "rewriting"
        ? { s: "checking", text: t("Rewriting") }
        : phase === "human"
          ? { s: "blocked", text: t("Both checks failed, so this advice isn’t shown") }
          : checked !== null && (phase === "done" || phase === "planning" || phase === "reviewing")
            ? { s: "passed", text: t("All {n} claims checked against the official source", { n: checked }) }
            : null;
  return (
    <>
      {badge && (
        <p className={s.badge} data-s={badge.s} role="status">
          <span className={s.dot} aria-hidden />
          {badge.text}
        </p>
      )}
      {!!blocked.length && (
        <div className={s.blocked}>
          <p>{t("Blocked by a second AI: these lines don’t match the official text")}</p>
          <ul className="grid gap-2">
            {blocked.map((v, i) => (
              <li key={i}>
                <p className={s.was}>{v.claim}</p>
                {v.quote && (
                  <blockquote className="mt-1">
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
        </div>
      )}
    </>
  );
}
