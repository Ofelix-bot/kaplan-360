"use client";

import { useState } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { AboutYouFields } from "./AboutYouFields";
import { FOCUS, OutLink } from "./parts";

// "Edit" in the heading's meta line: the plan's own answers in a sheet (from the right, or from the
// bottom on a phone). The plan behind it updates as they change, and says its new start here; focus
// goes back to Edit when the sheet closes.

export function EditSheet({ start }: { start: string }) {
  const t = useT();
  const wide = useMediaQuery("(min-width: 640px)");
  // Closed before leaving for Programmes, so it isn't left open on a page kept in the background.
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn("font-semibold text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground", FOCUS)}>{t("Edit")}</SheetTrigger>
      <SheetContent side={wide ? "right" : "bottom"} className={cn("gap-0 p-0", wide ? "data-[side=right]:w-full data-[side=right]:sm:max-w-md" : "max-h-[88dvh] rounded-t-xl")}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{t("About you")}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <AboutYouFields />
          <p role="status" className="text-[14px] font-medium text-foreground">
            {t("Your plan: master’s in {date}.", { date: start })}
          </p>
          <p className="text-[14px] text-muted-foreground">
            {t.rich("To change your programmes or English score, go to <a>Programmes</a>.", {
              a: (c) => (
                <OutLink href="/results" onClick={() => setOpen(false)}>
                  {c}
                </OutLink>
              ),
            })}
          </p>
        </div>
        <SheetFooter className="border-t">
          <SheetClose render={<Button />}>{t("Done")}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
