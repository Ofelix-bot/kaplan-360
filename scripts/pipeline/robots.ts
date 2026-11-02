// robots.txt parsing (RFC 9309): groups by user-agent, longest-match Allow/Disallow with * and $,
// Crawl-delay and Sitemap lines. Pure functions; fetching lives in http.ts.

export type RobotsRules = {
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
};

/** `aiAgents`: rules from groups that name an AI assistant fetching on a user's behalf (see AI_AGENTS). */
export type Robots = { rules: RobotsRules; aiAgents: RobotsRules[]; sitemaps: string[] };

/**
 * The pipeline passes page text to Claude, so a site that tells AI assistants to stay away is
 * treated as telling us too, even when it names no rule for our own token.
 */
export const AI_AGENTS = ["Claude-User", "ChatGPT-User", "Perplexity-User"];

type Group = { agents: string[]; allow: string[]; disallow: string[]; crawlDelay: number | null };

export function parseRobots(text: string, token: string): Robots {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" && value) current.allow.push(value);
    else if (key === "disallow" && value) current.disallow.push(value);
    else if (key === "crawl-delay") {
      const n = Number(value);
      if (isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  const named = (t: string) => groups.filter((g) => g.agents.some((a) => a !== "*" && t.toLowerCase().includes(a)));
  const own = named(token);
  // The group naming this crawler wins; otherwise the "*" group applies.
  const rules = merge(own.length ? own : groups.filter((g) => g.agents.includes("*")));
  const aiAgents = AI_AGENTS.map(named).filter((g) => g.length).map(merge);
  return { rules, aiAgents, sitemaps };
}

function merge(chosen: Group[]): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], crawlDelay: null };
  for (const g of chosen) {
    rules.allow.push(...g.allow);
    rules.disallow.push(...g.disallow);
    if (g.crawlDelay !== null) rules.crawlDelay = Math.max(rules.crawlDelay ?? 0, g.crawlDelay);
  }
  return rules;
}

/**
 * Allowed for our own token (its group, or "*"). Groups naming AI assistants (aiAgents) are kept for
 * the report but no longer block a fetch: decided by the project owner on 2026-10-19, for coverage.
 */
export function mayFetch(robots: Robots, pathWithQuery: string): boolean {
  return isAllowed(robots.rules, pathWithQuery);
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/** Whether the path (with query) may be fetched. The longest matching rule wins; Allow wins a tie. */
export function isAllowed(rules: RobotsRules, pathWithQuery: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  const consider = (patterns: string[], allow: boolean) => {
    for (const p of patterns) {
      if (!patternToRegex(p).test(pathWithQuery)) continue;
      const len = p.length;
      if (!best || len > best.len || (len === best.len && allow)) best = { len, allow };
    }
  };
  consider(rules.disallow, false);
  consider(rules.allow, true);
  return best ? (best as { allow: boolean }).allow : true;
}
