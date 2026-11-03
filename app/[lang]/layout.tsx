import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { AdviserDock } from "@/components/agent/AdviserDock";
import { KappyDock } from "@/components/kappy/KappyDock";
import Link from "@/components/i18n/Link";
import I18nProvider from "@/components/i18n/I18nProvider";
import ZhHansProvider from "@/components/i18n/ZhHansProvider";
import ZhHantProvider from "@/components/i18n/ZhHantProvider";
import { PauseProvider } from "@/components/shared/PauseProvider";
import { ReceiptHost } from "@/components/shared/receipt/ReceiptHost";
import { DEFAULT_LOCALE, HTML_LANG, isLocale } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";
import "../globals.css";

// One variable family for everything: headings use its expanded width (font-stretch 125%), body text the normal width.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

// Only the English pages are built ahead; the Chinese ones render on their first visit and are cached after
// (2026-11-02: the deploy's page-cache upload was too large with all three languages built ahead).
export function generateStaticParams() {
  return [{ lang: DEFAULT_LOCALE }];
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "Kaplan 360++",
    description: t(
      "Plan postgraduate study ahead: graduate outcomes, in-demand careers and the master's programmes that lead to them, for Singapore private-school diploma and degree students.",
    ),
    // Hackathon prototype: shared by link only.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#240f6e",
  viewportFit: "cover",
};

const NO_MESSAGES = {};
function EnProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="en" messages={NO_MESSAGES}>
      {children}
    </I18nProvider>
  );
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getT();
  // The dictionary travels as a client module per language (components/i18n/Zh*Provider), not as a prop: a prop
  // is copied into every page's HTML and RSC data.
  const Provider = lang === "zh-hans" ? ZhHansProvider : lang === "zh-hant" ? ZhHantProvider : EnProvider;
  return (
    <html lang={HTML_LANG[lang]} className={archivo.variable} data-scroll-behavior="smooth">
      <body>
        <Provider>
          {/* One "Pause animations" switch for the whole site (WCAG 2.2.2): the heroes, tiles and tickers read it. */}
          <PauseProvider>
            <a href="#main" className="skip-link">
              {t("Skip to content")}
            </a>
            <SiteHeader />
            <main id="main">{children}</main>
            {/* Kept quiet: how the site is built and the disclaimer are on Declaration; About us is the team's page. */}
            <footer className="site-footer">
              <div className="container footer-bar">
                <nav className="footer-links" aria-label={t("Site information")}>
                  <Link href="/declaration">{t("Declaration")}</Link>
                  <span aria-hidden="true">/</span>
                  <Link href="/about">{t("About us")}</Link>
                </nav>
                {/* The team and the year, bottom right: plain text, the same in every language. */}
                <span className="footer-team" translate="no">
                  ReFly.X, 2026
                </span>
              </div>
            </footer>
            {/* The site's one receipt drawer (components/shared/receipt): every page's footnotes and source
                lists open it, and the homepage store's showReceipts() reaches it through its bridge. */}
            <ReceiptHost />
            {/* The AI adviser beside the page (components/agent): desktop only, on the pages that offer it. */}
            <AdviserDock />
            {/* Kappy, the AI adviser's mascot, in the bottom-left corner of every page (components/kappy). */}
            <KappyDock />
          </PauseProvider>
        </Provider>
      </body>
    </html>
  );
}
