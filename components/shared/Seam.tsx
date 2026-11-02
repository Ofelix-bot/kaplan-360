import type { CSSProperties } from "react";
import { cn } from "cn";

// The soft join between a dark band and a light one (or back): a block of --seam-h with an oklab
// gradient from `from` to `to` (app/globals.css .seam, after .land-dusk). Decorative.

export function Seam({ from, to, className }: { from: string; to: string; className?: string }) {
  return <div aria-hidden className={cn("seam", className)} style={{ "--seam-from": from, "--seam-to": to } as CSSProperties} />;
}
