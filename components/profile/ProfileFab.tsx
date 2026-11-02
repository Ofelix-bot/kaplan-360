"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRightIcon, UserRoundPenIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { usePlan } from "@/lib/use-plan";
import { filledGroups, herePath, PROFILE_GROUPS, profileHref, rememberReturn, serviceOf } from "./profile";

// The floating profile button (plan D): a round button on the right edge of the seven service pages (never on
// /profile or elsewhere), with a ring for the share of the profile's four groups filled. It opens /profile
// with this page as `from`, and remembers how far down the page is, so "Back to …" returns to the same spot.
// It folds into a small tab at the edge; that choice is kept in localStorage (guarded: storage can be blocked).
// Styled in app/globals.css ("Profile button"), not Tailwind: the root layout mounts it, and /pathway and
// /outcomes don't load the workspace stylesheet. Above page content, below the header, menus and dialogs.
// Shown only after the browser is read, so the server HTML and the first render match.

const KEY = "kaplan360:profile-fab";
const EVENT = "kaplan360:profile-fab-change";
/** The choice made on this page view, for when storage is blocked. */
let memory: boolean | null = null;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "collapsed";
  } catch {
    return memory ?? false;
  }
}

function setCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(KEY, "collapsed");
    else window.localStorage.removeItem(KEY);
  } catch {}
  memory = collapsed;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const R = 25;
const C = 2 * Math.PI * R;

export function ProfileFab() {
  const t = useT();
  // Read so the button follows client navigation (and its `from` the new address).
  const pathname = usePathname();
  useSearchParams();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => null);
  const { answers, ready } = usePlan();

  if (collapsed === null || !ready || !serviceOf(pathname)) return null;

  const filled = filledGroups(answers);
  const n = PROFILE_GROUPS.filter((g) => filled[g]).length;
  const label = t("Your profile: {n} of {m} parts filled", { n, m: PROFILE_GROUPS.length });

  if (collapsed)
    return (
      <button type="button" className="pfab-tab" aria-label={t("Show the profile button")} onClick={() => setCollapsed(false)}>
        <UserRoundPenIcon aria-hidden size={16} />
      </button>
    );

  return (
    <div className="pfab">
      <Link href={profileHref(herePath())} className="pfab-link" aria-label={label} onClick={rememberReturn}>
        <svg className="pfab-ring" viewBox="0 0 56 56" aria-hidden="true">
          <circle className="pfab-track" cx="28" cy="28" r={R} />
          <circle className="pfab-done" cx="28" cy="28" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - n / PROFILE_GROUPS.length)} />
        </svg>
        <span className="pfab-face">
          <UserRoundPenIcon aria-hidden size={20} />
        </span>
      </Link>
      <button type="button" className="pfab-hide" aria-label={t("Hide the profile button")} onClick={() => setCollapsed(true)}>
        <ChevronRightIcon aria-hidden size={14} />
      </button>
    </div>
  );
}
