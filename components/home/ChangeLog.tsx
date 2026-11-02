import Link from "@/components/i18n/Link";
import { ArrowSquare } from "@/components/shared/ArrowSquare";
import { getChanges, type Change } from "@/lib/changes";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import { msg, type T } from "@/lib/i18n/translate";
import { schoolName } from "@/lib/site-names";

// "What changed": what the latest refresh of the official pages confirmed (lib/changes.ts). The
// homepage shows the newest few with a link here; /benefits shows every refresh. A batch from one
// place (a university announcing a run of sessions) is one row that opens to the list. Names and the
// pages' own words stay as published.

const TAG: Record<Change["change"], string> = {
  added: msg("Newly listed"),
  removed: msg("No longer listed"),
  deadline: msg("Deadline changed"),
  "next-deadline": msg("Next deadline"),
  date: msg("Date changed"),
  value: msg("Value changed"),
};
const KIND: Record<string, string> = {
  scholarship: msg("Scholarship"),
  "fee-reduction": msg("Fee reduction"),
  "application-fee-waiver": msg("Application fee waiver"),
  deadline: msg("Deadline"),
  event: msg("Event"),
  "applications-open": msg("Applications open"),
  "application-deadline": msg("Application deadline"),
};
/** This many changes of one kind from one place make a single row. */
const BATCH = 4;

type Row = { one: Change } | { batch: Change[] };

function rowsOf(list: Change[]): Row[] {
  const key = (c: Change) => `${c.university}|${c.change}|${c.kind}`;
  const size = list.reduce((m, c) => m.set(key(c), (m.get(key(c)) ?? 0) + 1), new Map<string, number>());
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const c of list) {
    const k = key(c);
    if (size.get(k)! < BATCH) rows.push({ one: c });
    else if (!seen.has(k)) {
      seen.add(k);
      rows.push({ batch: list.filter((x) => key(x) === k) });
    }
  }
  return rows;
}

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function What({ c, t, day }: { c: Change; t: T; day: (iso: string) => string }) {
  const shown = (s: string | null) => (isDate(s) ? day(s) : s);
  if (c.change === "added") return c.to ? <span className="cl-what">{shown(c.to)}</span> : null;
  if (c.change === "removed") return null;
  if (c.change === "next-deadline")
    return <span className="cl-what">{t("{date}, after the round that closed on {before}", { date: shown(c.to)!, before: shown(c.from)! })}</span>;
  return (
    <span className="cl-what">
      <s>{shown(c.from)}</s> <span aria-hidden="true">→</span>
      <span className="visually-hidden">{t("now")}</span> {shown(c.to)}
    </span>
  );
}

export default async function ChangeLog({ limit, full = false }: { limit?: number; full?: boolean }) {
  const t = await getT();
  const lang = await getLocale();
  const locale = INTL_LOCALE[lang];
  const { latest, entries, checks } = getChanges();
  if (!latest) return null;
  const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  // Chinese ranges come out of Intl as numbers ("18/10/2026至19/10/2026"): written out like single dates instead.
  const span = (a: string, b?: string) =>
    !b || b === a
      ? day(a)
      : locale.startsWith("zh")
        ? `${day(a)}至${a.slice(0, 4) === b.slice(0, 4) ? day(b).replace(/^\d{4}年/, "") : day(b)}`
        : fmt.formatRange(new Date(`${a}T00:00:00`), new Date(`${b}T00:00:00`));
  const runs = full ? checks : [latest];

  return (
    <div className={`cl${full ? " is-full" : ""}`} id={full ? "changes" : undefined}>
      {runs.map((run) => {
        const all = rowsOf(entries.filter((e) => e.checked === run.checked));
        const rows = limit ? all.slice(0, limit) : all;
        return (
          <section key={run.checked} className="cl-run" aria-label={t("Changes found on {date}", { date: day(run.checked) })}>
            <header className="cl-head">
              <p className="cl-title">
                <span className="cl-pulse" aria-hidden="true" />
                {full ? t("Checked {date}", { date: day(run.checked) }) : t("What changed this week")}
              </p>
              <p className="cl-meta">
                {t("{n} official pages read again on {date}, compared with {since}.", { n: run.pages.benefits + run.pages.dates, date: day(run.checked), since: span(run.since, run.sinceLatest) })}
              </p>
            </header>
            {rows.length ? (
              <ul className="cl-list">
                {rows.map((r) => {
                  if ("one" in r) {
                    const c = r.one;
                    return (
                      <li key={c.id} className={`cl-row is-${c.change}`}>
                        <span className="cl-tag">{t(TAG[c.change])}</span>
                        <span className="cl-body">
                          <span className="cl-uni">
                            {schoolName(lang, c.university).name} · {t(KIND[c.kind] ?? c.kind)}
                          </span>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="cl-name">
                            {c.title}
                            <span className="visually-hidden"> ({t("official page")})</span> <span aria-hidden="true">↗</span>
                          </a>
                          <What c={c} t={t} day={day} />
                        </span>
                      </li>
                    );
                  }
                  const [first] = r.batch;
                  const dates = r.batch.map((c) => c.to ?? c.from).filter(isDate).sort();
                  return (
                    <li key={first.id} className={`cl-row is-${first.change}`}>
                      <span className="cl-tag">{t(TAG[first.change])}</span>
                      <span className="cl-body">
                        <span className="cl-uni">
                          {schoolName(lang, first.university).name} · {t(KIND[first.kind] ?? first.kind)}
                        </span>
                        <details className="cl-batch">
                          <summary className="cl-name">
                            {dates.length
                              ? t("{n} new dates, {span}", { n: r.batch.length, span: span(dates[0], dates.at(-1)) })
                              : t("{n} changes", { n: r.batch.length })}
                          </summary>
                          <ul>
                            {r.batch.map((c) => (
                              <li key={c.id}>
                                <a href={c.url} target="_blank" rel="noopener noreferrer">
                                  {c.title}
                                </a>{" "}
                                <What c={c} t={t} day={day} />
                              </li>
                            ))}
                          </ul>
                        </details>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="cl-none">{t("No changes on these pages since then.")}</p>
            )}
            {limit && all.length > limit && (
              <Link href="/benefits#changes" className="see-all">
                {t("All {n} changes", { n: entries.filter((e) => e.checked === run.checked).length })}<ArrowSquare />
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
