import { FileSearchIcon, HistoryIcon, ListChecksIcon, ScanTextIcon, Trash2Icon, UserRoundSearchIcon } from "lucide-react";
import cscse from "@/data/raw/cscse-sg-2026-09.json";
import { getChanges, getQuickCheck } from "@/lib/changes";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";

// /declaration: how the site is built (where its numbers come from, how AI is used, what it runs on),
// the disclaimer, and what happens to the visitor's answers. These were the footer's paragraphs; the
// footer now only links here and to About us. Wording is the site's own; only the "Built with" line
// is new.

export async function Declaration() {
  const t = await getT();
  const locale = await getLocale();
  const { latest } = getChanges();
  const quick = getQuickCheck();
  const day = (iso: string, month: "short" | "long" = "short") =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month, year: "numeric" });
  const steps = [
    ...(latest ? [{ icon: FileSearchIcon, title: t("Read {n} official pages", { n: latest.pages.benefits + latest.pages.dates }), note: day(latest.checked) }] : []),
    { icon: ScanTextIcon, title: t("Extracted fees, entry requirements, deadlines and job openings") },
    { icon: ListChecksIcon, title: t("Checked every value against the exact wording of its source page") },
    { icon: Trash2Icon, title: t("Removed any value not stated on the source page") },
  ];

  return (
    <div className="ui bg-(--land-ground) text-foreground">
      <div className="home-wrap pt-[164px] pb-28">
        <h1 className="font-heading text-[clamp(44px,7vw,104px)] leading-[1.12] font-bold tracking-[-0.02em]">{t("Declaration")}</h1>

        <section id="built" aria-labelledby="built-title" className="mt-14 scroll-mt-16 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex max-w-[38rem] flex-col gap-5 text-lg text-pretty text-(--land-body)">
            <h2 id="built-title" className="font-heading text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
              {t("How this site is built")}
            </h2>
            <p>{t("Programme information is drawn from official university pages, while graduate statistics come from official national surveys. Each figure links to its source. Please verify all details on the official page before applying.")}</p>
            <p>
              {t(
                "How AI is used: Claude, an AI model developed by Anthropic, reads official university and employer pages to extract programme details, scholarships and job openings, and drafts the “What to do” checklists. Every extracted value is checked against the exact wording of its source page and removed if it does not appear there. While you browse, Claude is used for one feature only: “Fill in the form for me” in Start planning sends the sentence you enter to Claude, which uses it to fill in your answers. The sentence is not stored. Statistics are reproduced exactly as published.",
              )}
            </p>
            <p>{t("This site is built with Next.js, React, Tailwind CSS, Motion and shadcn/ui on Base UI. Programme data is stored in Supabase, and the site is hosted on Netlify.")}</p>
          </div>

          <div className="h-fit rounded-3xl bg-(--land-night) p-7 text-(--land-night-ink) sm:p-10">
            <h3 className="font-heading text-2xl font-bold tracking-[-0.01em]">{t("How each figure is verified")}</h3>
            <p className="mt-2 text-pretty text-(--land-night-body)">{t("Claude reads each official page. Information is shown only if it appears verbatim on the source page, and pages that cannot be read automatically are reviewed by a person.")}</p>
            <ol className="mt-7 flex flex-col gap-4">
              {steps.map((s) => (
                <Step key={s.title} icon={<s.icon aria-hidden className="size-3.5" />}>
                  <span>{s.title}</span>
                  {"note" in s && <span className="text-(--land-night-muted) tabular-nums"> · {s.note}</span>}
                </Step>
              ))}
              <Step icon={<UserRoundSearchIcon aria-hidden className="size-3.5" />}>
                <span className="block">{t("Checked CSCSE notices manually")}</span>
                <span className="mt-1 block text-(--land-night-body)">
                  {t.rich(
                    "Our automated pipeline does not read the website of the Chinese Service Center for Scholarly Exchange (CSCSE). A team member therefore manually transcribed its published list of Singapore private education institutions on {date}. These entries are labelled <b>Checked by a person</b>.",
                    { b: (c) => <span className="font-medium text-(--land-night-ink)">{c}</span> },
                    { date: <span className="tabular-nums">{day(cscse.transcribedAt, "long")}</span> },
                  )}
                </span>
              </Step>
              {latest && (
                <Step icon={<HistoryIcon aria-hidden className="size-3.5" />}>
                  <span>{t("Last full review")}</span>
                  <span className="text-(--land-night-muted) tabular-nums"> · {day(latest.checked)}</span>
                </Step>
              )}
              {/* A quick re-check after it (scripts/changes/quick-check.ts): its pages fetched again, every quote still there. */}
              {quick && (!latest || quick.checked > latest.checked) && (
                <Step icon={<HistoryIcon aria-hidden className="size-3.5" />}>
                  <span>{t("Last verification: {n} of {total} pages still match the information on this site", { n: quick.confirmed, total: quick.pages })}</span>
                  <span className="text-(--land-night-muted) tabular-nums"> · {day(quick.checked)}</span>
                </Step>
              )}
            </ol>
          </div>
        </section>

        <section aria-labelledby="disclaimer" className="mt-16 flex max-w-[38rem] flex-col gap-5 text-lg text-pretty text-(--land-body)">
          <h2 id="disclaimer" className="font-heading text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
            {t("Disclaimer")}
          </h2>
          <p>
            {t.rich(
              "<b>Kaplan 360++</b> is a concept prototype developed for the Kaplan (Singapore) AI For Impact 2026 hackathon. The “Plan ahead” introduction, which animates the Kaplan logo, is concept work created for this event and is not an official Kaplan brand asset. The Kaplan logo remains the property of Kaplan.",
              { b: (c) => <span translate="no">{c}</span> },
            )}
          </p>
          {locale !== "en" && (
            <p>
              {t(
                "This page is translated from English. University and programme names are given in Chinese: the institution’s own Chinese name where it has one, otherwise a translation, marked as such, with the English name beside it. Quotations from university pages stay in their original language, as published. If this translation and the English version differ, the English version prevails.",
              )}
            </p>
          )}
        </section>

        <section id="answers" aria-labelledby="answers-title" className="mt-16 scroll-mt-16 flex max-w-[38rem] flex-col gap-5 text-lg text-pretty text-(--land-body)">
          <h2 id="answers-title" className="font-heading text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
            {t("Your answers")}
          </h2>
          <p>{t("Your answers in Start planning are stored only in your browser and are never sent to us. The only exception is a sentence you choose to submit through “Fill in the form for me”: it is sent to Claude for processing and is not stored.")}</p>
        </section>
      </div>
    </div>
  );
}

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[0.95rem] leading-relaxed">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-(--land-night-body) text-(--land-night)">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
