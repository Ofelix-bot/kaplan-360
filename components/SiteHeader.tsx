"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import Link from "@/components/i18n/Link";
import { AdviserToggle } from "@/components/agent/AdviserDock";
import { DRAFT } from "@/content/draft";
import { INDUSTRIES } from "@/lib/careers/industries";
import { industryHref } from "@/lib/careers/links";
import { closeExampleNow, exampleHref, openExampleNow } from "@/lib/example-link";

// Three items: Insights (/move), Services (the site's tools: a full-width panel under the
// header on wide screens, an expandable group in the phone menu) and About us. Links go through the i18n
// Link, so Chinese pages keep their prefix. The panel has three columns: the lead with "Start at step 1"
// (/profile); the guided flow (Your profile, Career compass, Find a master's, Your plan) over More tools, each
// with a one-line note; and Jobs by industry, the 16 /careers industry pages (lib/careers/industries.ts, a
// static list: the header never reads the database) with a link to all 16 on /careers. Next steps is now
// /plan's Map tab (next.config.ts redirects it). Each tool link but Your profile opens with a worked example
// (Mei on /pathway, Arjun elsewhere): the link carries ?example= for shared URLs and opens the example on
// click, so a click on the page you are on works too; the industries open with Arjun too. Arrow keys move
// through every link in the panel as one list. "Start planning" and "Start at step 1" (/profile) are the
// visitor's own flow, so they close any open example. Menus close on a pick, on Escape, on a press outside,
// when focus leaves them, and on the browser's back and forward (popstate): reading the route here
// (usePathname) would stop routes rendered at request time from prerendering a shell. The header is light,
// clear at the top of a page that opens on a hero, and indigo while it sits over that hero (globals.css).

type Service = { href: string; name: string; note?: string; example?: string };

// The guided flow, in its order. Your profile is the visitor's own answers: no example (the page closes any open one).
const FLOW: Service[] = [
  { href: "/profile", name: "Your profile", note: "Fill it in once, use it everywhere" },
  { href: "/careers", name: "Career compass", note: "Roles by industry, and your skills gap", example: "arjun" },
  { href: "/results", name: "Find a master’s", note: "Matched to your background", example: "arjun" },
  { href: "/plan", name: "Your plan", note: "Turn your results into a plan", example: "arjun" },
];

const MORE: Service[] = [
  // The visitor's own words, read into their own answers: no example (the page closes any open one).
  { href: "/parents", name: "For parents", note: "Tell us about your child, in your own words" },
  // The AI adviser's own page; on wide screens the header's button opens it beside the page instead.
  { href: "/adviser", name: "AI adviser", note: "Master’s first or work first? Ask the AI" },
  { href: "/pathway", name: "Routes to a degree", note: "The ways to a bachelor’s", example: "mei" },
  { href: "/algorithm", name: "Core Algorithm", note: "How the match rate is worked out" },
  { href: "/outcomes", name: "Graduate outcomes", note: "Employment rates and starting pay", example: "arjun" },
];

// The industry pages, in the careers map's order. Their names are data: English on English pages.
const INDUSTRY_LINKS: Service[] = INDUSTRIES.map((i) => ({ href: industryHref(i.id), name: i.short, example: "arjun" }));
const ALL_INDUSTRIES: Service = { href: "/careers#industries", name: DRAFT.menu.allIndustries, example: "arjun" };

const serviceHref = (s: Service) => (s.example ? exampleHref(s.href, s.example) : s.href);
const openService = (s: Service) => {
  if (s.example) openExampleNow(s.example);
};

/**
 * The menu's wording. Chinese pages use the wording supplied for this menu, keyed "<English> (menu)" so the
 * same English elsewhere (Your profile, Media…) keeps its own translation; English pages show the English.
 */
function useMenuT() {
  const t = useT();
  return (s: string) => {
    const key = `${s} (menu)`;
    const out = t(key);
    return out === key ? s : out;
  };
}

function Chevron() {
  return (
    <svg className="nav-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

/** Desktop: "Services" and its full-width panel of links (a disclosure; arrow keys move between the links). */
function ServicesMenu({ open, setOpen }: { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const m = useMenuT();
  const locale = useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPop = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [open, setOpen]);

  // Every link in the panel, Services then Industries, so the arrows cross from one group to the next.
  const links = () => [...(panel.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
  const focusAt = (i: number) => {
    const all = links();
    all[(i + all.length) % all.length]?.focus();
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const last = e.key === "ArrowUp";
    setOpen(true);
    // The panel stops being inert on the next frame.
    requestAnimationFrame(() => focusAt(last ? -1 : 0));
  };

  const pick = (s: Service) => {
    openService(s);
    setOpen(false);
  };

  const onPanelKey = (e: React.KeyboardEvent) => {
    const all = links();
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") focusAt(i + 1);
    else if (e.key === "ArrowUp") focusAt(i - 1);
    else if (e.key === "Home") focusAt(0);
    else if (e.key === "End") focusAt(-1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="nav-group"
      ref={root}
      onBlur={(e) => {
        // Focus moving to something outside closes it. A press on the panel's plain text (focus goes to
        // the body: no relatedTarget) keeps it open; a press outside is handled by onDown above.
        const next = e.relatedTarget as Node | null;
        if (next && !root.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="nav-trigger"
        aria-expanded={open}
        aria-controls={`${id}-services`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKey}
      >
        {m("Services")}
        <Chevron />
      </button>
      <div id={`${id}-services`} className="nav-mega" data-open={open || undefined} inert={!open}>
        <div className="nav-mega-inner">
          <div ref={panel} className="container nav-mega-grid" onKeyDown={onPanelKey}>
            <div className="nav-mega-lead">
              <h2 className="nav-mega-title">{m("Services")}</h2>
              <p>{m(DRAFT.menu.lead)}</p>
              <Link
                href="/profile"
                className="nav-mega-start"
                onClick={() => {
                  closeExampleNow();
                  setOpen(false);
                }}
              >
                {m(DRAFT.menu.start)} <ArrowRightIcon size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="nav-mega-group nav-mega-tools">
              {[
                { head: DRAFT.menu.flow, items: FLOW, key: "flow" },
                { head: DRAFT.menu.more, items: MORE, key: "more" },
              ].map((g) => (
                <div key={g.key} className="nav-mega-set">
                  <h3 id={`${id}-${g.key}-title`} className="nav-mega-head">
                    {m(g.head)}
                  </h3>
                  <ul className="nav-mega-links nav-mega-services" aria-labelledby={`${id}-${g.key}-title`}>
                    {g.items.map((s) => (
                      <li key={s.href}>
                        <Link href={serviceHref(s)} onClick={() => pick(s)}>
                          <span className="nav-mega-name">{m(s.name)}</span>
                          {s.note && <span className="nav-mega-note">{m(s.note)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="nav-mega-group">
              <div className="nav-mega-headrow">
                <h3 id={`${id}-industries-title`} className="nav-mega-head">
                  {m(DRAFT.menu.industries)}
                </h3>
                <Link href={serviceHref(ALL_INDUSTRIES)} className="nav-mega-all" onClick={() => pick(ALL_INDUSTRIES)}>
                  {m(ALL_INDUSTRIES.name)} <ArrowRightIcon size={13} aria-hidden="true" />
                </Link>
              </div>
              <ul className="nav-mega-links nav-mega-industries" aria-labelledby={`${id}-industries-title`}>
                {INDUSTRY_LINKS.map((s) => {
                  const name = m(s.name);
                  return (
                    <li key={s.href}>
                      <Link href={serviceHref(s)} lang={name === s.name && locale !== "en" ? "en" : undefined} onClick={() => pick(s)}>
                        {name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SiteHeader() {
  const t = useT();
  const m = useMenuT();
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const mobile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Focus inside the menu would be lost when it turns inert: back to the button that opened it.
      if (mobile.current?.contains(document.activeElement)) toggle.current?.focus();
      setOpen(false);
    };
    const onPop = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Crossing the wide-screen breakpoint swaps one menu for the other: close both, so neither stays open
  // unseen (the phone menu would keep the page from scrolling, the Services panel would leave its scrim).
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 960px)");
    const onChange = () => {
      setOpen(false);
      setServicesOpen(false);
      setIndustriesOpen(false);
      setMegaOpen(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  // At the top with every menu closed; the CSS makes that clear only on a page with a hero. Reading
  // the route here (usePathname) would stop routes rendered at request time from prerendering a shell.
  const menuOpen = open || megaOpen;
  const top = !scrolled && !menuOpen;
  const close = () => {
    setOpen(false);
    setServicesOpen(false);
    setIndustriesOpen(false);
  };

  return (
    <>
      <header className={`site-header${top ? " is-top" : ""}`} data-menu={menuOpen ? "open" : undefined}>
        <div className="container bar">
          <Link href="/" className="brand" onClick={close} aria-label={t("Kaplan 360++ home")}>
            {/* Official Kaplan logo; the file is white, so the header shows the mask below instead. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/kaplan-logo.svg" alt="Kaplan" width={79} height={26} fetchPriority="high" />
            {/* The same logo in the text colour: ink on the light header, white over a hero (globals.css). */}
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-suffix" translate="no">
              360++
            </span>
          </Link>

          <nav className="nav-links" aria-label={t("Main")}>
            <Link href="/move">{t("Insights")}</Link>
            <ServicesMenu open={megaOpen} setOpen={setMegaOpen} />
            <Link href="/about">{t("About us")}</Link>
          </nav>

          <AdviserToggle />

          <Link href="/profile" className="button button-accent header-cta" onClick={() => closeExampleNow()}>
            {t("Start planning")} <ArrowRightIcon className="arrow" size={16} aria-hidden="true" />
          </Link>

          <LanguageSwitcher onPick={close} />

          <button
            ref={toggle}
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("Close menu") : t("Open menu")}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="bars" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Dims the page under the Services panel; a press on it closes the panel (outside the menu). */}
      <div className="nav-scrim" data-open={megaOpen || undefined} aria-hidden="true" />

      <div id="mobile-menu" ref={mobile} className={`mobile-menu ${open ? "is-open" : ""}`} inert={!open}>
        <Link href="/move" onClick={close}>
          {t("Insights")}
        </Link>
        <button type="button" className="mobile-group-toggle" aria-expanded={servicesOpen} aria-controls="mobile-services" onClick={() => setServicesOpen((v) => !v)}>
          {m("Services")}
          <Chevron />
        </button>
        <div id="mobile-services" className="mobile-sub" hidden={!servicesOpen}>
          <p className="mobile-sub-lead">{m(DRAFT.menu.lead)}</p>
          {[
            { head: DRAFT.menu.flow, items: FLOW, key: "flow" },
            { head: DRAFT.menu.more, items: MORE, key: "more" },
          ].map((g) => (
            <div key={g.key} className="mobile-sub-set">
              <p className="mobile-sub-head" id={`mobile-${g.key}-title`}>
                {m(g.head)}
              </p>
              <ul aria-labelledby={`mobile-${g.key}-title`}>
                {g.items.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={serviceHref(s)}
                      onClick={() => {
                        openService(s);
                        close();
                      }}
                    >
                      {m(s.name)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mobile-group-toggle"
          aria-expanded={industriesOpen}
          aria-controls="mobile-industries"
          onClick={() => setIndustriesOpen((v) => !v)}
        >
          {m(DRAFT.menu.industries)}
          <Chevron />
        </button>
        <div id="mobile-industries" className="mobile-sub mobile-sub-industries" hidden={!industriesOpen}>
          <ul>
            {[...INDUSTRY_LINKS, ALL_INDUSTRIES].map((s) => {
              const name = m(s.name);
              return (
                <li key={s.href} className={s === ALL_INDUSTRIES ? "mobile-sub-all" : undefined}>
                  <Link
                    href={serviceHref(s)}
                    lang={name === s.name && locale !== "en" ? "en" : undefined}
                    onClick={() => {
                      openService(s);
                      close();
                    }}
                  >
                    {name}
                    {s === ALL_INDUSTRIES && <ArrowRightIcon className="arrow" size={15} aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <Link href="/about" onClick={close}>
          {t("About us")}
        </Link>
        <Link
          href="/profile"
          className="button button-accent"
          onClick={() => {
            closeExampleNow();
            close();
          }}
        >
          {t("Start planning")} <ArrowRightIcon className="arrow" size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
