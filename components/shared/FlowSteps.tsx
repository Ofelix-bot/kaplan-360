"use client";

import { useEffect, useRef } from "react";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button } from "@/components/ui/button";
import { exampleHref } from "@/lib/example-link";
import { msg } from "@/lib/i18n/translate";
import { usePlan } from "@/lib/use-plan";

// The guided flow's slim step bar (Insights → Profile → Compass → Industry → Programmes → Plan), at the top of
// each page in the flow, styled after SectionBand (its tokens, type and brand-ink underline) but not sticky.
// Steps before the current one are marked done (a check); the current one carries aria-current="step" and
// the underline. Industry has no page of its own on the bar: it is a link only from deeper in (a role page),
// back to that role's industry. While a worked example is open, the service steps keep it (?example=, as the
// Services menu does); Insights and Profile never carry one. On phones the steps scroll sideways inside the
// bar, the current one kept in view. FlowNext is the flow's "Next: …" button at the bottom of a page.

export type FlowCurrent = "profile" | "compass" | "industry" | "role" | "programmes" | "plan";

type Step = { id: Exclude<FlowCurrent, "role"> | "insights"; label: string; href: string | null; example: boolean };

const STEPS: Step[] = [
  { id: "insights", label: msg("Insights"), href: "/move", example: false },
  { id: "profile", label: msg("Profile"), href: "/profile", example: false },
  { id: "compass", label: msg("Compass"), href: "/careers", example: true },
  { id: "industry", label: msg("Industry"), href: null, example: true },
  { id: "programmes", label: msg("Programmes"), href: "/results", example: true },
  { id: "plan", label: msg("Plan"), href: "/plan", example: true },
];

/** `path`, carrying the open example (if any) when the step keeps it. */
function useHref() {
  const { example } = usePlan();
  return (path: string, keep: boolean) => (keep && example ? exampleHref(path, example) : path);
}

export function FlowSteps({ current, industryHref = "/careers", className }: {
  current: FlowCurrent;
  /** Where the Industry step goes from a role page: that role's industry page (else the careers entry). */
  industryHref?: string;
  className?: string;
}) {
  const t = useT();
  const href = useHref();
  const strip = useRef<HTMLDivElement>(null);
  const at = STEPS.findIndex((s) => s.id === (current === "role" ? "industry" : current));

  // Keep the current step in view where the steps scroll sideways (no smooth scroll: it runs on arrival).
  useEffect(() => {
    const box = strip.current;
    const on = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!box || !on || box.scrollWidth <= box.clientWidth) return;
    const a = on.getBoundingClientRect(),
      b = box.getBoundingClientRect();
    if (a.left < b.left || a.right > b.right) box.scrollLeft += a.right > b.right ? a.right - b.right + 16 : a.left - b.left - 16;
  }, [current]);

  return (
    <nav aria-label={t("Your route")} className={cn("border-b border-solid border-(--land-line) text-(--text)", className)}>
      <div className="home-wrap">
        <div ref={strip} className="-mr-4 flex h-11 min-w-0 overflow-x-auto [scrollbar-width:none] min-[720px]:mr-0 [&::-webkit-scrollbar]:hidden">
          <ol className="m-0 flex h-full list-none items-stretch gap-0.5 p-0 pr-4 min-[720px]:pr-0">
            {STEPS.map((s, i) => {
              const done = i < at;
              const on = i === at;
              const to = s.id === "industry" ? (current === "role" ? industryHref : null) : s.href;
              const body = (
                <>
                  {done ? (
                    <CheckIcon aria-hidden className="size-3.5 text-(--brand-ink)" strokeWidth={2.6} />
                  ) : (
                    <span aria-hidden className={cn("tabular-nums", on ? "text-(--accent-ink)" : "")}>
                      {i + 1}
                    </span>
                  )}
                  {t(s.label)}
                  {done && <span className="sr-only"> ({t("done")})</span>}
                  <span aria-hidden className={cn("absolute inset-x-2.5 bottom-0 h-0.5 bg-(--brand-ink)", on ? "opacity-100" : "opacity-0")} />
                </>
              );
              const look = cn(
                "relative flex items-center gap-1.5 px-2.5 text-[13.5px] font-semibold whitespace-nowrap no-underline",
                on || done ? "text-(--text)" : "text-(--muted)",
              );
              return (
                <li key={s.id} className="flex items-stretch">
                  {i > 0 && (
                    <span aria-hidden className="flex items-center text-(--muted) opacity-50">
                      <ChevronRightIcon className="size-3.5" />
                    </span>
                  )}
                  {to ? (
                    <Link
                      href={href(to, s.example)}
                      aria-current={on ? "step" : undefined}
                      className={cn(
                        look,
                        "rounded-sm transition-colors duration-(--motion-ui-dur) ease-(--motion-ui) hover:text-(--text) motion-reduce:transition-none",
                        "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <span aria-current={on ? "step" : undefined} className={look}>
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}

/** The flow's primary "next" button: `label` is an English message; the arrow is lucide's (Archivo has no "→"). */
export function FlowNext({ href, label, keepExample = true, className }: {
  href: string;
  label: string;
  /** Carry an open worked example (?example=), as the Services menu does. */
  keepExample?: boolean;
  className?: string;
}) {
  const t = useT();
  const to = useHref();
  return (
    <Button size="lg" className={cn("h-11 gap-2 rounded-full px-5 text-[15px] font-semibold", className)} render={<Link href={to(href, keepExample)} />} nativeButton={false}>
      {t(label)}
      <ArrowRightIcon aria-hidden data-icon="inline-end" className="size-4" />
    </Button>
  );
}
