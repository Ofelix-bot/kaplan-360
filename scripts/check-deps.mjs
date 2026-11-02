// Dependency policy: one library per job, each at one version.
//
// Fails when
//   - package.json depends on something that isn't on the list below,
//   - a second library for a job the front-end stack covers turns up anywhere in the tree (a second
//     icon set, animation library, UI primitive kit, drag-and-drop library, state store or
//     split-pane library),
//   - any package that ships with the site is installed at two versions.
//
//   npm run check:deps

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

/** Every direct dependency, and the job it does. */
const ALLOWED = {
  next: "framework",
  react: "framework",
  "react-dom": "framework",
  "@base-ui/react": "UI primitives under shadcn/ui",
  "class-variance-authority": "shadcn/ui component variants",
  cn: "class names for shadcn/ui",
  "lucide-react": "icons",
  motion: "animation",
  "react-resizable-panels": "resizable layout",
  "@dnd-kit/core": "drag and drop",
  "@dnd-kit/sortable": "drag and drop: sortable lists",
  "@dnd-kit/utilities": "drag and drop: CSS helpers",
  zustand: "state",
  "@supabase/supabase-js": "database",
  "@anthropic-ai/sdk": "Claude API (Fill in the form for me; the data pipeline)",
  jspdf: "the plan as a PDF",
  "@xyflow/react": "node graph: the next-steps map (positions are our own; its zustand is overridden to ours)",
  // Development only
  tailwindcss: "styling",
  "@tailwindcss/postcss": "styling",
  typescript: "types",
  "@types/node": "types",
  "@types/react": "types",
  "@types/react-dom": "types",
  eslint: "lint",
  "eslint-config-next": "lint",
  tsx: "data pipeline: running scripts",
  "playwright-core": "data pipeline: rendering pages",
  exceljs: "data pipeline: spreadsheets",
  "pdfjs-dist": "data pipeline: PDF text with positions",
  unpdf: "data pipeline: PDF text",
  "opencc-js": "Traditional Chinese messages",
  supabase: "database CLI (migrations)",
};

/** A second library for a job the stack already covers. Matched anywhere in the tree. */
const BANNED = [
  [/^(radix-ui|@radix-ui\/.*|react-aria(-components)?|@react-aria\/.*|@headlessui\/react|@ark-ui\/react|@mui\/.*|antd|@chakra-ui\/.*)$/, "UI primitives: use @base-ui/react through components/ui"],
  [/^(react-icons|@heroicons\/react|@tabler\/icons-react|@phosphor-icons\/react|@hugeicons\/.*|@remixicon\/react|@iconify\/react)$/, "icons: use lucide-react"],
  [/^(tw-animate-css|tailwindcss-animate|react-spring|@react-spring\/.*|gsap|animejs|react-transition-group|@formkit\/auto-animate)$/, "animation: use motion"],
  [/^(react-resizable|allotment|react-split|split\.js|react-split-pane|react-mosaic-component)$/, "layout: use react-resizable-panels"],
  [/^(react-beautiful-dnd|@hello-pangea\/dnd|react-dnd|@dnd-kit\/react|sortablejs|react-sortablejs|@atlaskit\/pragmatic-drag-and-drop)$/, "drag and drop: use @dnd-kit/core and @dnd-kit/sortable"],
  [/^(redux|@reduxjs\/toolkit|jotai|recoil|mobx|valtio|xstate|@tanstack\/store)$/, "state: use zustand"],
];

/** Allowed only underneath the package named: motion re-exports framer-motion. */
const ONLY_UNDER = { "framer-motion": "motion" };

function tree(args) {
  let out;
  try {
    out = execSync(`npm ls --all --json ${args}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
  } catch (error) {
    out = error.stdout; // npm ls exits non-zero for unmet optional peers; the JSON is still complete
  }
  return JSON.parse(out.toString());
}

/** name -> versions, plus every (parent, name) edge. */
function walk(node) {
  const versions = new Map();
  const edges = [];
  const visit = (n, parent) => {
    for (const [name, child] of Object.entries(n.dependencies ?? {})) {
      if (!child.version) continue;
      if (!versions.has(name)) versions.set(name, new Set());
      versions.get(name).add(child.version);
      edges.push([parent, name]);
      visit(child, name);
    }
  };
  visit(node, pkg.name);
  return { versions, edges };
}

const problems = [];

const direct = { ...pkg.dependencies, ...pkg.devDependencies };
for (const [name, range] of Object.entries(direct)) {
  if (!ALLOWED[name]) problems.push(`${name} is not on the allowed list (scripts/check-deps.mjs)`);
  if (!/^\d+\.\d+\.\d+$/.test(range)) problems.push(`${name}@${range}: pin an exact version`);
}
for (const [name, parent] of Object.entries(ONLY_UNDER)) {
  if (direct[name]) problems.push(`${name} must not be a direct dependency (it comes with ${parent})`);
}

const production = walk(tree("--omit=dev"));
const everything = walk(tree(""));

for (const [parent, name] of everything.edges) {
  const banned = BANNED.find(([pattern]) => pattern.test(name));
  if (banned) problems.push(`${name} (via ${parent}): ${banned[1]}`);
  if (ONLY_UNDER[name] && parent !== ONLY_UNDER[name]) problems.push(`${name} (via ${parent}) is only allowed under ${ONLY_UNDER[name]}`);
}

const duplicates = (versions) =>
  [...versions].filter(([, v]) => v.size > 1).map(([name, v]) => `${name}@${[...v].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(" | ")}`);

const productionDuplicates = duplicates(production.versions);
for (const d of productionDuplicates) problems.push(`two versions ship with the site: ${d}`);
const devDuplicates = duplicates(everything.versions).filter((d) => !productionDuplicates.includes(d));

console.log(`Ships with the site: ${production.versions.size} packages, ${productionDuplicates.length} at two versions.`);
console.log(`Whole tree: ${everything.versions.size} packages; build tools at two versions: ${devDuplicates.length}`);
for (const d of devDuplicates) console.log(`  ${d}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\nDependency policy: passed.");
