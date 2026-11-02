import { Building2Icon, ExternalLinkIcon } from "lucide-react";
import { cn } from "cn";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import type { RoleEmployer } from "@/lib/careers/types";
import { COMPANY_LISTS } from "@/lib/data/careers";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { msg } from "@/lib/i18n/translate";
import { fromRule, type ReceiptView } from "@/lib/receipts/model";

// The role page's employers (plan §3.2; Q26): only employers whose own careers site was checked for this
// role. Each one with openings is a card: the name, the lists it comes from (Fortune Global 500, LinkedIn
// Top Companies SG, employers of Kaplan graduates), "N openings · checked {date}" with its footnote (our
// count, dated, linked to the search we read), and "See openings" on the employer's own site. Employers
// checked with no opening fold into one line; a failed check is never shown. No section when nothing was
// checked. No table (Q13).

const C = DRAFT.careers;

// The receipt text behind each openings figure.
const OPENINGS = msg("Kaplan 360++'s count: openings in Singapore for this role on {company}'s own careers site, read on the day shown.");

const openingsId = (e: Pick<RoleEmployer, "roleId" | "employerId">) => `openings:${e.roleId}:${e.employerId}`;

const H2 = "m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,34px)] leading-[1.12] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

export async function RoleEmployers({ employers, className }: { employers: RoleEmployer[]; className?: string }) {
  const t = await getT();
  const locale = INTL_LOCALE[await getLocale()];
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const hiring = employers.filter((e) => e.status === "ok" && e.openings > 0).sort((a, b) => b.openings - a.openings || a.company.localeCompare(b.company));
  const none = employers.filter((e) => e.status !== "failed" && e.openings === 0).sort((a, b) => a.company.localeCompare(b.company));
  if (hiring.length === 0 && none.length === 0) return null;

  const views: ReceiptView[] = hiring.map((e) => fromRule(openingsId(e), t(OPENINGS, { company: e.company }), { read: e.checkedOn.slice(0, 10), url: e.searchUrl ?? e.careersUrl, where: e.company }));

  return (
    <section aria-labelledby="cr-employers-title" className={cn("home-wrap flex flex-col gap-6 border-t border-(--land-line) py-12 sm:py-14", className)}>
      <h2 id="cr-employers-title" className={H2}>
        {t(C.role.employersTitle)}
      </h2>
      <ReceiptSection receipts={views}>
        {hiring.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {hiring.map((e) => {
              const href = e.searchUrl ?? e.careersUrl;
              return (
                <li key={e.employerId} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-(--land-line) bg-(--land-card) p-5">
                  <p className="m-0 inline-flex min-w-0 items-center gap-2 font-heading text-[18px] leading-tight font-bold text-(--text)">
                    <Building2Icon aria-hidden className="size-5 shrink-0 text-(--brand-ink)" />
                    <span lang="en" className="min-w-0 wrap-break-word">
                      {e.company}
                    </span>
                  </p>
                  {e.companyLists.length > 0 && (
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {e.companyLists.map((l) => (
                        <li key={l} className="rounded-full border border-(--land-line) px-2.5 py-1 text-[12px] leading-snug text-(--land-body)">
                          {t(COMPANY_LISTS[l] ?? l)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="m-0 text-[15px] leading-snug font-semibold text-(--text) tabular-nums">
                    {t(e.openings === 1 ? C.hot.openingsOne : C.hot.openings, { n: e.openings, date: day(e.checkedOn) })}
                    <Fn id={openingsId(e)} />
                  </p>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1.5 self-start rounded-lg text-[14px] font-semibold text-(--brand-ink) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
                    >
                      {t(C.role.seeOpenings)}
                      <span className="sr-only"> {e.company}</span>
                      <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {none.length > 0 && (
          <p className="m-0 mt-4 max-w-[48rem] text-[14px] leading-snug text-(--land-body)">
            <span className="font-semibold text-(--text)">{t(C.role.noOpenings, { n: none.length })}</span>{" "}
            <span lang="en">{none.map((e) => e.company).join(", ")}</span>
          </p>
        )}
        {views.length > 0 && <SourceList className="mt-6" />}
      </ReceiptSection>
    </section>
  );
}
