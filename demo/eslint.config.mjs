import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// One library per job (see scripts/check-deps.mjs, which checks the installed tree).
const oneLibraryPerJob = [
  { group: ["framer-motion", "framer-motion/*"], message: "Import from motion/react." },
  { group: ["react-icons", "react-icons/*", "@heroicons/*", "@tabler/icons-react", "@phosphor-icons/*", "@hugeicons/*", "@radix-ui/react-icons"], message: "Icons come from lucide-react." },
  { group: ["radix-ui", "@radix-ui/*", "react-aria", "react-aria-components", "@headlessui/*"], message: "UI primitives are Base UI, used through components/ui." },
  { group: ["react-beautiful-dnd", "@hello-pangea/dnd", "react-dnd", "@dnd-kit/react"], message: "Drag and drop is @dnd-kit/core with @dnd-kit/sortable." },
  { group: ["redux", "@reduxjs/toolkit", "jotai", "recoil", "mobx", "valtio"], message: "State lives in Zustand stores (lib/store.ts, lib/data.ts)." },
  { group: ["react-resizable", "allotment", "react-split", "react-split-pane"], message: "Resizable layout is react-resizable-panels, through components/ui/resizable." },
  { group: ["clsx", "tailwind-merge", "classnames"], message: "Join class names with cn." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: oneLibraryPerJob }],
    },
  },
  // Outside components/ui, use the shadcn/ui components, not the primitives under them:
  // that keeps one design language and one place to change it.
  {
    files: ["app/**", "components/app/**", "hooks/**", "lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...oneLibraryPerJob,
            { group: ["@base-ui/react", "@base-ui/react/*"], message: "Use the component in components/ui." },
            { group: ["react-resizable-panels"], importNames: ["Group", "Panel", "Separator"], message: "Use ResizablePanelGroup, ResizablePanel and ResizableHandle from components/ui/resizable." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
