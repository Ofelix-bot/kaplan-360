"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { UserRoundIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button } from "@/components/ui/button";
import { DRAFT } from "@/content/draft";
import { applyExampleFromUrl, closeExampleNow } from "@/lib/example-link";
import { personaById } from "@/lib/personas";
import { usePlan } from "@/lib/use-plan";

// The one worked-example banner on the service pages, shown while an example student is open (lib/personas,
// opened from the Services menu, the homepage tiles and the /move cards, or ?example=<id>). Two skins share
// the copy (content/draft/example.ts) and the two actions:
// - "Use my own details" closes the example and stays on the page, which then shows the visitor's own
//   answers or its empty state;
// - "Follow the full flow" closes the example and goes to the homepage hero (/#start).
// ExampleBannerUi sits on the .ui pages (/results, /next-steps, /where-you-stand, /plan); ExampleBannerSite
// on the site pages without .ui (/pathway, /outcomes), styled by .ex-banner in app/globals.css.
// Both read the example from this browser (lib/use-plan), so they work with or without the plan store.

/**
 * ?example=<id> arriving on a page that is already open (a soft navigation to the same route, which runs
 * no mount effect): opens that example, or only strips the parameter when it is already open. Under its
 * own Suspense boundary, so the page stays prerendered.
 */
function ExampleParam() {
  const id = useSearchParams().get("example");
  useEffect(() => {
    if (id) applyExampleFromUrl();
  }, [id]);
  return null;
}

function WatchParam() {
  return (
    <Suspense fallback={null}>
      <ExampleParam />
    </Suspense>
  );
}

/** The open example student, or null. */
function useExample() {
  const { example } = usePlan();
  return personaById(example);
}

/** The banner's sentence. `strong`: the name's class (Tailwind on .ui pages; the site pages' own <strong>). */
function Line({ name, now, strong }: { name: string; now: string; strong?: string }) {
  const t = useT();
  return <>{t.rich(DRAFT.example.line, { b: (c) => <strong className={strong}>{c}</strong> }, { name, now: t(now) })}</>;
}

/**
 * On the .ui pages. `skin="results"` uses the /results skin's tokens (app/ui.css, data-rs-skin); the
 * other .ui pages use the landing tokens their grounds are drawn with.
 */
export function ExampleBannerUi({ skin = "land", className }: { skin?: "results" | "land"; className?: string }) {
  const t = useT();
  const p = useExample();
  return (
    <>
      <WatchParam />
      {p && (
        <div
          role="status"
          aria-label={t(DRAFT.example.label)}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 text-[13px] leading-snug text-foreground sm:text-sm",
            skin === "results" ? "border-(--rs-line) bg-(--rs-raised)" : "border-[color-mix(in_srgb,var(--accent)_45%,var(--land-line))] bg-[color-mix(in_srgb,var(--accent)_14%,var(--land-card))]",
            className,
          )}
        >
          <UserRoundIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-[1_1_240px] text-pretty">
            <Line name={p.name} now={p.who} strong="font-semibold text-foreground" />
          </p>
          <span className="flex flex-wrap items-center gap-1">
            <Button variant="outline" size="sm" onClick={closeExampleNow}>
              {t(DRAFT.example.own)}
            </Button>
            <Button variant="link" size="sm" render={<Link href="/#start" onClick={closeExampleNow} />} nativeButton={false}>
              {t(DRAFT.example.flow)}
            </Button>
          </span>
        </div>
      )}
    </>
  );
}

/**
 * On the site pages without .ui. `readUrl`: opens ?example=<id> on mount (these pages have no app shell that
 * does it), before anything else reads the answers.
 */
export function ExampleBannerSite({ readUrl = false }: { readUrl?: boolean }) {
  const t = useT();
  const p = useExample();
  useEffect(() => {
    if (readUrl) applyExampleFromUrl();
  }, [readUrl]);
  return (
    <>
      {readUrl && <WatchParam />}
      {p && (
        <div className="ex-banner" role="status" aria-label={t(DRAFT.example.label)}>
          <p>
            <Line name={p.name} now={p.who} />
          </p>
          <div className="ex-banner-actions">
            <button type="button" className="button button-quiet" onClick={closeExampleNow}>
              {t(DRAFT.example.own)}
            </button>
            <Link href="/#start" className="ex-banner-link" onClick={closeExampleNow}>
              {t(DRAFT.example.flow)}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
