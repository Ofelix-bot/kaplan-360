import Link from "@/components/i18n/Link";
import { getT } from "@/lib/i18n/server";

// About us: the team, ReFly.X. A first draft for the team to fill in (roles, photos, a line each);
// how the site is built stays on /declaration.

const TEAM = ["Felix", "Roxie", "Lydia", "Rebecca"];

export async function AboutUs() {
  const t = await getT();
  return (
    <div className="ui min-h-svh bg-(--land-ground) text-foreground">
      <div className="home-wrap pt-[164px] pb-28">
        <h1 className="font-heading text-[clamp(44px,7vw,104px)] leading-[1.12] font-bold tracking-[-0.02em]">{t("About us")}</h1>

        <div className="mt-10 flex max-w-[38rem] flex-col gap-5 text-lg text-pretty text-(--land-body)">
          <p className="font-heading text-2xl leading-snug font-bold tracking-[-0.01em] text-foreground sm:text-3xl">
            {t.rich("We’re <b>ReFly.X</b>, a team of four building Kaplan 360++ for Kaplan (Singapore) AI For Impact 2026.", {
              b: (c) => <span translate="no">{c}</span>,
            })}
          </p>
          <p>{t("Kaplan 360++ is for Kaplan diploma and degree students working out what comes next. Every option on it comes with the official page it was read from, so the decision stays yours, made at your own pace.")}</p>
        </div>

        <section aria-labelledby="team" className="mt-16">
          <h2 id="team" className="font-heading text-2xl font-bold tracking-[-0.01em] sm:text-3xl">
            {t("The team")}
          </h2>
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((name) => (
              <li key={name} className="flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-(--land-night) font-heading text-lg font-bold text-(--land-night-ink)">
                  {name[0]}
                </span>
                <span translate="no" className="font-heading text-xl font-bold">
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-16 max-w-[38rem] text-lg text-pretty text-(--land-body)">
          {t.rich("How the site is built, and where its numbers come from, is set out in the <a>Declaration</a>.", {
            a: (c) => (
              <Link href="/declaration" className="font-medium text-foreground underline underline-offset-4">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
