"use client";

import { cn } from "cn";
import { CheckIcon, PlusIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { transitions } from "@/lib/motion";
import { useModel } from "./model";

/** The icon swaps with a quick scale and fade, so the change reads as a confirmation. */
function SwapIcon({ on }: { on: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={on ? "on" : "off"}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={transitions.popup}
        className="inline-flex"
      >
        {on ? <CheckIcon /> : <PlusIcon />}
      </motion.span>
    </AnimatePresence>
  );
}

/** Adds a programme to the shortlist or takes it off (the shortlist is kept with the answers, in this browser). */
export function ShortlistToggle({ id, name, labelled = false }: { id: string; name: string; labelled?: boolean }) {
  const t = useT();
  const { answers, toggleStar } = useModel();
  const on = answers.shortlist.includes(id);

  if (labelled) {
    return (
      <Button variant={on ? "secondary" : "default"} size="sm" className={cn(on && "[&_svg]:text-primary")} onClick={() => toggleStar(id)} aria-pressed={on}>
        <SwapIcon on={on} />
        {on ? t("In shortlist") : t("Add to shortlist")}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={on ? "secondary" : "ghost"}
            size="icon-sm"
            className={cn(on && "text-primary")}
            onClick={() => toggleStar(id)}
            aria-pressed={on}
            aria-label={on ? t("Remove from shortlist: {name}", { name }) : t("Add to shortlist: {name}", { name })}
          />
        }
      >
        <SwapIcon on={on} />
      </TooltipTrigger>
      <TooltipContent>{on ? t("Remove from shortlist") : t("Add to shortlist")}</TooltipContent>
    </Tooltip>
  );
}
