import type { NextConfig } from "next";

// The ten careers of the old /careers (data/raw/careers.json) and the nearest new role page each one now
// opens (Q24: always a role, never an industry page). Picked by scripts/careers/build-careers-data.mjs and
// kept in data/raw/careers-roles.json "redirects"; scripts/check-careers.ts checks every line here against it.
// Named one by one, never a wildcard, so the new /careers/industries/… and /careers/roles/… stay reachable.
const OLD_CAREERS: Record<string, string> = {
  "data-analyst-scientist": "roles/data-analyst-associate-data-engineer",
  "ai-ml-engineer": "roles/artificial-intelligence-machine-learning-engineer",
  "cybersecurity-analyst": "roles/security-operations-analyst",
  "financial-analyst-fintech": "roles/business-analyst-market-research-analyst-market-analyst",
  "digital-marketing-manager": "roles/digital-marketing-executive",
  "supply-chain-logistics-manager": "roles/logistics-solutions-analyst",
  "software-engineer": "roles/software-engineer",
  "registered-nurse": "roles/staff-nurse",
  "counsellor-psychology-associate": "roles/counsellor",
  "communications-pr": "roles/digital-marketing-executive",
};
const OLD = Object.entries(OLD_CAREERS);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The build prerenders hundreds of pages that read Supabase at once; on the free instance a few queries
  // then hit the statement timeout (2026-10-29: 4 of 5 builds). Retry a failed page, and run fewer at a time.
  experimental: {
    staticGenerationRetryCount: 3,
    staticGenerationMaxConcurrency: 4,
  },
  // Languages (lib/i18n/config.ts): English keeps its URLs, served by app/[lang] with lang "en";
  // Chinese pages carry their prefix. Plain rewrites rather than a proxy, so hosting needs no
  // edge function. They run after files and static routes, so public files, /data and /api are untouched.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        { source: "/", destination: "/en" },
        { source: "/:path((?!en(?:/|$)|zh-hans(?:/|$)|zh-hant(?:/|$)|data/|api/|_next/).+)", destination: "/en/:path" },
      ],
      fallback: [],
    };
  },
  // One English address per page. /profile was Start planning's first three steps until 2026-10-22 (their old
  // addresses then opened /results); since 2026-10-30 it is the student's profile page again. /insights became /move
  // (2026-10-29): 308s to the top of /move, the guided flow's first step. /next-steps is becoming /plan's Map tab
  // (2026-10-30): 307s to /plan?view=map while its page file stays. /where-you-stand gave way to the Core Algorithm page
  // (2026-11-02): 307s to /algorithm while its page file stays. The /en ones come before /en/:path* so each is one hop.
  // The old career pages 308 to their new role page, the /en ones before /en/:path* for the same reason.
  // /careers/industries and /careers/roles have no page of their own: they open the careers entry page.
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/insights", destination: "/move", permanent: true },
      { source: "/en/next-steps", destination: "/plan?view=map", permanent: false },
      { source: "/en/where-you-stand", destination: "/algorithm", permanent: false },
      ...OLD.map(([from, to]) => ({ source: `/en/careers/${from}`, destination: `/careers/${to}`, permanent: true })),
      { source: "/en/careers/:section(industries|roles)", destination: "/careers", permanent: false },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      { source: "/insights", destination: "/move", permanent: true },
      { source: "/:lang(zh-hans|zh-hant)/insights", destination: "/:lang/move", permanent: true },
      { source: "/next-steps", destination: "/plan?view=map", permanent: false },
      { source: "/:lang(zh-hans|zh-hant)/next-steps", destination: "/:lang/plan?view=map", permanent: false },
      { source: "/where-you-stand", destination: "/algorithm", permanent: false },
      { source: "/:lang(zh-hans|zh-hant)/where-you-stand", destination: "/:lang/algorithm", permanent: false },
      ...OLD.flatMap(([from, to]) => [
        { source: `/careers/${from}`, destination: `/careers/${to}`, permanent: true },
        { source: `/:lang(zh-hans|zh-hant)/careers/${from}`, destination: `/:lang/careers/${to}`, permanent: true },
      ]),
      { source: "/careers/:section(industries|roles)", destination: "/careers", permanent: false },
      { source: "/:lang(zh-hans|zh-hant)/careers/:section(industries|roles)", destination: "/:lang/careers", permanent: false },
    ];
  },
};

export default nextConfig;
