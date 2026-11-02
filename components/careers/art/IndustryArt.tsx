"use client";

import { cn } from "cn";
import { HEADS } from "./heads";

// An industry's static line drawing (plan §C), beside the industry page's headline. Its code loads only on
// that industry's page. Nothing for an industry without a drawing (lib/careers/art.ts, hasIndustryHead).
// Decorative: the headline says what it shows.

export function IndustryArt({ industryId, className }: { industryId: string; className?: string }) {
  const Head = HEADS[industryId];
  if (!Head) return null;
  return (
    <div aria-hidden="true" className={cn("[&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)}>
      <Head />
    </div>
  );
}
