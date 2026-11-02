"use client";

import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { useCareersAutoExample } from "@/lib/careers/use-student";

// The first child of every /careers page: opens the worked example by the rules in lib/careers/use-student.ts
// (the URL's ?example=, else Arjun on a first visit with no degree of the visitor's own), and shows the
// worked-example banner while one is open ("Use my own details" / "Follow the full flow").

export function ExampleGate({ className }: { className?: string }) {
  useCareersAutoExample();
  return <ExampleBannerUi skin="land" className={className} />;
}
