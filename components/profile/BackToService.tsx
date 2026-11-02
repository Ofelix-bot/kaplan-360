"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { restoreScroll, returnScroll, safeFrom, serviceOf } from "./profile";

// "Back to {service}" at the top of /profile, shown when a service page opened it (?from=<its address>): back
// to that address, at the scroll position remembered when the student left it. Only the site's own service
// pages count as `from`. Read in the browser under its own Suspense boundary, so the page stays prerendered.

export function BackToService() {
  const t = useT();
  const router = useRouter();
  const from = safeFrom(useSearchParams().get("from"));
  const service = from ? serviceOf(from) : null;
  if (!from || !service) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 self-start"
      onClick={() => {
        const y = returnScroll(from);
        // No position remembered (a shared link): the page opens at its top, as any link does.
        router.push(from, { scroll: y <= 0 });
        restoreScroll(from, y);
      }}
    >
      <ArrowLeftIcon aria-hidden data-icon="inline-start" />
      {t("Back to {service}", { service: t(service.label) })}
    </Button>
  );
}
