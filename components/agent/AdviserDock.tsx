"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SparklesIcon, XIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { AdviserApp } from "@/components/agent/AdviserApp";
import { Button } from "@/components/ui/button";
import { DOCK_FROM, dockable, startDock, useDock } from "@/lib/agent/dock-store";
import type { PageContext } from "@/lib/agent/types";
import { useAdviser } from "@/lib/agent/client";
import "@/app/ui.css";

// The adviser beside the page, not over it: a column fixed to the right under the header, while html[data-adviser-dock]
// (app/globals.css) gives the page and the footer a right margin of the same width, so the page reflows narrower.
// Desktop only (DOCK_FROM and up); a page offers it by mounting <AdviserContext/>, so the homepage and /move never
// show it. The left edge drags to resize (DOCK_MIN–DOCK_MAX); Escape closes it.

/** Marks the page this is: the dock can open here, and the adviser starts from what this page shows. */
export function AdviserContext({ page }: { page: PageContext["page"] }) {
  const setContext = useDock((s) => s.setContext);
  useEffect(() => {
    setContext({ page });
    return () => setContext(null);
  }, [page, setContext]);
  return null;
}

/** Opens the adviser: the dock on a wide screen, else the /adviser page. Used in the header and on the pages. */
export function useOpenAdviser() {
  const { context, setOpen, open } = useDock();
  const locale = useLocale();
  return {
    open,
    toggle: () => {
      if (dockable(context)) setOpen(!open);
      else window.location.assign(locale === "en" ? "/adviser" : `/${locale}/adviser`);
    },
  };
}

/** The header's button. Wide screens only: the phone menu links to /adviser instead. */
export function AdviserToggle() {
  const t = useT();
  const { open, toggle } = useOpenAdviser();
  return (
    <button type="button" className="button header-adviser" aria-pressed={open} onClick={toggle}>
      <SparklesIcon size={16} aria-hidden="true" />
      {t("AI adviser")}
    </button>
  );
}

/** A page's own prompt to open the adviser, e.g. under the /outcomes chart. */
export function AdviserPrompt({ label }: { label: string }) {
  const { toggle } = useOpenAdviser();
  const t = useT();
  return (
    <button type="button" className="button button-solid adviser-prompt" onClick={toggle}>
      <SparklesIcon size={16} aria-hidden="true" />
      {label}
      <span className="adviser-prompt-note">{t("AI reads your profile and these figures")}</span>
    </button>
  );
}

export function AdviserDock() {
  const t = useT();
  const { open, width, context, setOpen, setWidth } = useDock();
  const busy = useAdviser((s) => s.status === "running" || s.status === "asking" || s.status === "auditing");
  const [wide, setWide] = useState(false);
  useEffect(() => {
    startDock();
    const mq = window.matchMedia(`(min-width: ${DOCK_FROM}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const shown = open && wide && !!context && context.page !== "adviser";
  useEffect(() => {
    const html = document.documentElement;
    if (!shown) {
      html.removeAttribute("data-adviser-dock");
      return;
    }
    html.setAttribute("data-adviser-dock", "");
    html.style.setProperty("--dock-w", `${width}px`);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.removeAttribute("data-adviser-dock");
    };
  }, [shown, width, busy, setOpen]);

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setWidth(window.innerWidth - ev.clientX);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  if (!shown || !context) return null;
  return (
    <aside
      className="ui fixed top-(--ui-header) right-0 bottom-0 z-40 flex w-(--dock-w) flex-col border-l bg-background text-foreground shadow-[-8px_0_24px_-16px_rgb(0_0_0/0.25)]"
      aria-label={t("AI adviser")}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("Resize the adviser")}
        tabIndex={0}
        onPointerDown={drag}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setWidth(width + 24);
          if (e.key === "ArrowRight") setWidth(width - 24);
        }}
        className="absolute inset-y-0 -left-1 w-2 cursor-col-resize hover:bg-primary/20 focus-visible:bg-primary/30 focus-visible:outline-none"
      />
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SparklesIcon className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">{t("AI adviser")}</h2>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase">{t("AI")}</span>
        <Link href="/adviser" className="ml-auto text-xs text-muted-foreground underline">
          {t("Full page")}
        </Link>
        <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)} aria-label={t("Close the adviser")}>
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <AdviserApp context={context} compact />
      </div>
    </aside>
  );
}
