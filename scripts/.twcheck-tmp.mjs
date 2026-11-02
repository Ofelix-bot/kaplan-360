import postcss from "postcss"; import tailwind from "@tailwindcss/postcss"; import { readFileSync } from "node:fs"; import path from "node:path";
const root = process.argv[2]; const f = path.join(root, "app/ui.css");
const css = (await postcss([tailwind()]).process(readFileSync(f, "utf8"), { from: f })).css;
for (const c of process.argv.slice(3)) { const esc = c.replace(/[^\w-]/g, (m) => "\\" + m); console.log(css.includes("." + esc) ? "ok  " : "MISS", c); }
