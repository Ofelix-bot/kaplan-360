import { ArrowRightIcon } from "lucide-react";
import { cn } from "cn";

// The CTA arrow: lucide's arrow in a small amber square (app/globals.css .arrow-square). Inside a
// hovered or focused link or button it nudges 4px right. Decorative: the link's words name it.

export function ArrowSquare({ className }: { className?: string }) {
  return (
    <span className={cn("arrow-square", className)} aria-hidden>
      <ArrowRightIcon size={16} aria-hidden />
    </span>
  );
}
