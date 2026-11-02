"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { cn } from "cn";
import { useLocalize, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { herePath, profileHref, rememberReturn } from "./profile";

// "Edit" beside a one-line summary of the student's answers (/careers' "You", Where you stand): opens /profile
// with this page as `from` and remembers how far down it is. The address is read at the click, so it is the
// one the browser shows then (filters and all); the plain href serves a new tab.

const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)";

/** `part`: opens /profile at that part (#part-1, #part-2). */
export function EditProfileLink({ className, children, part }: { className?: string; children?: ReactNode; part?: 1 | 2 }) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalize();
  return (
    <Link
      href={part ? `/profile#part-${part}` : "/profile"}
      aria-label={children ? undefined : t("Edit your profile")}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, className)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        const from = herePath();
        rememberReturn();
        router.push(localize(profileHref(from)) + (part ? `#part-${part}` : ""));
      }}
    >
      <PencilIcon aria-hidden className="size-3.5" />
      {children ?? t("Edit")}
    </Link>
  );
}
