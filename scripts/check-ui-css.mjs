// Checks that the Tailwind CSS of the shadcn/ui workspace (app/ui.css) can't touch the rest of the
// site. Once a visitor has opened /results, its stylesheet stays loaded as they move to other pages,
// so it must not:
//   - generate a class the site's own stylesheet (app/globals.css) defines, or that the site's
//     other components use in className,
//   - style an element outside .ui and shadcn's popups ([data-slot]) with a base rule,
//   - set a custom property the site's stylesheet sets, outside the theme layer (which sits under
//     the site's styles, so the site's values win).
// React Flow's base stylesheet, imported there for /next-steps' map, counts by its own .react-flow
// classes only: every one of its rules starts with one of them.
// Compiles app/ui.css the way the build does (@tailwindcss/postcss) and fails on any of these.
//
//   npm run check:ui-css

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");

const css = (await postcss([tailwind()]).process(read("app/ui.css"), { from: path.join(root, "app/ui.css") })).css;

/**
 * Class names in a stylesheet's selectors (not its values), unescaped. In a selector `scoped` accepts,
 * only the classes `own` accepts are counted: the others match only together with those.
 */
function classesIn(text, scoped = () => false, own = () => true) {
  const out = new Set();
  postcss.parse(text).walkRules((rule) => {
    for (const sel of rule.selectors ?? [rule.selector]) {
      const keep = scoped(sel) ? own : () => true;
      for (const m of sel.matchAll(/\.((?:\\.|[\w-])+)/g)) {
        const c = m[1].replace(/\\(.)/g, "$1");
        if (keep(c)) out.add(c);
      }
    }
  });
  return out;
}

/**
 * React Flow's base stylesheet (@xyflow/react/dist/base.css, imported for /next-steps' map): a selector
 * whose first compound carries one of its .react-flow classes matches only inside the map, so the
 * state classes it pairs them with (.dragging, .selected, .top, …) reach nothing of the site's.
 */
const REACT_FLOW = /^(?:[a-z]+)?\.react-flow(?:__[\w-]+)?(?![\w-])/;
const scoped = (sel) => REACT_FLOW.test(sel.trim());
const reactFlowClass = (c) => /^react-flow/.test(c);

// What the workspace's CSS generates.
const generated = classesIn(css, scoped, reactFlowClass);

// What the site uses outside the workspace: its stylesheet and its other components' class names.
const site = classesIn(read("app/globals.css"));
const files = [];
const walk = (d) => {
  for (const f of readdirSync(path.join(root, d))) {
    const p = path.join(d, f);
    if (statSync(path.join(root, p)).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
};
["app", "components"].forEach(walk);
const used = new Set();
// The new /careers routes put the workspace's .ui root in app/[lang]/careers (build spec §8), so they count as the
// workspace's. The old [slug] route still uses the site's classes and stays counted. /plan's frame (PlanTabs) and
// /results' page wrappers (the flow's step bar and next button) sit on that .ui root too (2026-10-30), and so does the
// Programme finder (components/finder, 2026-11-01), the Core Algorithm page (components/algorithm, 2026-11-02) For parents (components/parents, 2026-11-02), the AI adviser (components/agent, 2026-11-02; its v2 page components/adviser,
// 2026-11-03) and Kappy (components/kappy, CSS modules on the same root).
for (const f of files.filter((p) => !/components[\\/](ui|workspace|landing|shared|stand|next-steps|plan[\\/]road|careers|profile|finder|parents|algorithm|agent|adviser|kappy)[\\/]|components[\\/]plan[\\/]PlanTabs\.tsx$|app[\\/]\[lang\][\\/]careers[\\/](?:page\.tsx$|industries[\\/]|roles[\\/])|app[\\/]\[lang\][\\/]results[\\/]page\.tsx$/.test(p))) {
  for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) for (const c of (m[1] ?? m[2]).split(/\s+/)) if (/^[\w-]+$/.test(c)) used.add(c);
}

const problems = [];
for (const c of generated) {
  if (site.has(c)) problems.push(`.${c} is generated here and defined in app/globals.css`);
  else if (used.has(c)) problems.push(`.${c} is generated here and used by the site's components`);
}

// Base rules must be scoped; custom properties outside the theme layer must not be the site's.
const ast = postcss.parse(css);
const siteVars = new Set([...read("app/globals.css").matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
ast.walkRules((rule) => {
  const layer = (() => {
    for (let p = rule.parent; p; p = p.parent) if (p.type === "atrule" && p.name === "layer") return p.params;
    return null;
  })();
  if (layer === "base") {
    const unscoped = rule.selectors.filter((s) => !/\.ui\b|\[data-slot/.test(s) && !/^:root/.test(s));
    if (unscoped.length) problems.push(`base rule outside .ui and [data-slot]: ${unscoped.join(", ")}`);
  }
  if (layer !== "theme") rule.walkDecls(/^--/, (decl) => {
    if (siteVars.has(decl.prop)) problems.push(`${decl.prop} is set outside the theme layer (${rule.selector}) and also by app/globals.css`);
  });
});

console.log(`app/ui.css: ${generated.size} class names generated; the site uses ${site.size} in app/globals.css and ${used.size} in its components.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("Workspace CSS is scoped: passed.");
