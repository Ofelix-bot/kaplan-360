# Kaplan 360++ stack demo

A working slice of Kaplan 360++ built on one fixed front-end stack: find a master's programme,
see who was admitted, rank a shortlist and track applications. It is a separate app in the
`demo/` folder; the main site (the parent folder) is untouched.

```bash
cd demo
npm install
npm run dev        # http://localhost:3100
npm run check      # lint + types + dependency policy
npm run build      # static site in out/
```

## The stack

| Job | Library | Where |
| --- | --- | --- |
| Components | shadcn/ui, Nova style, on Base UI 1.9.0 | `components/ui` (source in the repo) |
| Icons | Lucide (`lucide-react`) | everywhere |
| Animation | Motion (`motion/react`) | `lib/motion.ts` holds every curve and timing |
| Layout | react-resizable-panels 4 | `components/ui/resizable.tsx` |
| Drag and drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) | `components/app/workspace-dnd.tsx`, `board.tsx` |
| State | Zustand 5 | `lib/store.ts` (persisted in the browser), `lib/data.ts` |

The project was created with `shadcn init --template next --preset nova --base base`, then
`shadcn eject` inlined `shadcn/tailwind.css` into `app/globals.css`, so no shadcn package is
installed and every component's source is here to read and change.

## Rules, and what enforces them

- **One library per job.** ESLint's `no-restricted-imports` (in `eslint.config.mjs`) rejects
  imports of other icon sets, animation, drag-and-drop, state, split-pane or class-name
  libraries, and `framer-motion` itself (use `motion/react`).
- **One design language.** Outside `components/ui`, code may not import Base UI or the raw
  react-resizable-panels parts: it uses the shadcn/ui components. Colours are shadcn's tokens
  set to Kaplan indigo and amber in `app/globals.css`; type is Archivo, wide for headings.
- **No duplicate dependencies.** `npm run check:deps` (`scripts/check-deps.mjs`) fails when a
  direct dependency isn't on its list, when a second library for a job appears anywhere in the
  tree, or when a package that ships with the page is installed at two versions. It writes
  `lib/stack-report.json`, shown in the page's Stack popover. Versions are pinned exactly;
  `overrides` in `package.json` fold two same-major duplicates in the build tools (postcss,
  eslint-utils). The rest are ESLint plugins that need different major versions of small
  helpers; they never reach the browser.
- **Animation is Motion's.** shadcn's `tw-animate-css` and the CSS keyframe utilities were
  removed. Popover, Select, Tooltip and Sheet animate with Motion through Base UI's `render`
  prop; Base UI waits for the opacity animation before it unmounts a popup, so exits play too.
  dnd-kit still moves items while sorting (that is the drag library's own job), using the same
  curve and duration as Motion. Hover and focus colour changes are plain CSS transitions.
  `MotionConfig reducedMotion="user"` drops movement for people who ask for less motion.

## Data

`public/data/programmes.json` holds the 855 programmes that have reported admits, trimmed from
the live site's `/data/programmes` by `npm run data:snapshot`. The figures are aggregates of
published admission reports (sources and caveats under "About these figures" on each
programme); they describe past admits, not anyone's chances. Nothing the student enters leaves
the browser.
