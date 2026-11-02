"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { InfoIcon, PlusIcon } from "lucide-react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "cn";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DURATION, transitions } from "@/lib/motion";

// /move's content drawer: what a screen leaves out (the roads' other figures, the receipts behind "Here by
// default", what is coming next) opens here. The receipt drawer's shell (components/shared/receipt
// ReceiptDrawer): the site's right-side Sheet, full width on phones and 28rem from sm, sliding in 2.5rem
// on the UI curve (opacity only with reduced motion). A receipt chip inside it opens the receipt drawer
// over it. The trigger is a small button with a plus; tone "night" is for the dark ground. Without
// scripts the trigger does nothing and the screen still reads whole: the drawer only adds.

export function MoveDrawer({
  trigger,
  eyebrow,
  title,
  description,
  tone = "light",
  icon = "plus",
  className,
  style,
  children,
}: {
  trigger: string;
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "light" | "night";
  /** The trigger's icon: a plus ("Read more"), or an "i" where the drawer holds the evidence behind a screen. */
  icon?: "plus" | "info";
  className?: string;
  /** On the drawer's body: custom properties its content reads (a road's accent), since it is portalled out. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const closed = reduce ? { opacity: 0 } : { opacity: 0, x: "2.5rem" };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-[15px] font-semibold underline decoration-current/30 underline-offset-4 transition-[text-decoration-color] duration-200 hover:decoration-current motion-reduce:transition-none",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid",
          tone === "night" ? "text-(--land-night-ink)" : "text-(--brand-ink)",
          className,
        )}
      >
        {icon === "info" ? <InfoIcon aria-hidden className="size-4 shrink-0" /> : <PlusIcon aria-hidden className="size-4 shrink-0" />}
        {trigger}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        render={(renderProps, state) => (
          <motion.div
            {...(renderProps as HTMLMotionProps<"div">)}
            initial={closed}
            animate={state.open ? { opacity: 1, x: 0 } : closed}
            transition={reduce ? { duration: DURATION.base, ease: "linear" } : transitions.ui}
          />
        )}
      >
        <SheetHeader className="gap-1 border-b p-4 pr-12">
          {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
          <SheetTitle className="text-lg leading-snug text-balance">{title}</SheetTitle>
          {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
        </SheetHeader>
        <div style={style} className="flex flex-col gap-6 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-sm">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One part of a drawer: a small heading over its content. */
export function DrawerPart({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && <h3 className="m-0 text-[13px] font-semibold tracking-[0.02em] text-muted-foreground">{title}</h3>}
      {children}
    </section>
  );
}
