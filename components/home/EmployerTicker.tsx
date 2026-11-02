import { getT } from "@/lib/i18n/server";
import Info from "./Info";
import Reveal from "./Reveal";
import deck from "@/data/raw/kaplan-degree-enrolment-day-2026-03.json";
import logos from "@/data/raw/employer-logos.json";

// The employers Kaplan graduates name, as a slow band of logos (homepage ① and /outcomes).

const logoOf = logos.logos as Record<string, { file: string }>;

/** A company by its logo (data/raw/employer-logos.json); a government agency, or a company without one, by name. */
function Employer({ name }: { name: string }) {
  const logo = logoOf[name];
  return (
    <li className={logo ? "is-logo" : undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element -- small self-hosted SVGs */}
    {logo ? <img src={logo.file} alt={name} height={24} loading="lazy" decoding="async" /> : name}
    </li>
  );
}

export default async function EmployerTicker() {
  const t = await getT();
  const names = deck.graduateEmployers.namesEn;
  return (
    <Reveal className="ticker-wrap">
      <div className="container ticker-head">
        <p className="ticker-title">{t("Where Kaplan graduates work")}</p>
        <Info id="employers-info" title={t("Where Kaplan graduates work")}>
          <p>
            {t(
              "Company logos are trademarks of their owners, shown only to identify the employers named in the survey; no endorsement or partnership is implied. Logo files from Wikimedia Commons. Government agencies are shown by name.",
            )}
          </p>
        </Info>
      </div>
      <div className="ticker">
        <ul className="ticker-track" aria-label={t("Employers named by Kaplan graduates")}>
          {names.map((n) => (
            <Employer key={n} name={n} />
          ))}
        </ul>
        {/* The second copy makes the loop seamless; screen readers get the list once. */}
        <ul className="ticker-track" aria-hidden="true">
          {names.map((n) => (
            <Employer key={n} name={n} />
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
