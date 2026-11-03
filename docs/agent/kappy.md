# Kappy: the AI adviser's mascot

A 64 × 96 pixel robot drawn as SVG. Original character.

## Files

| File | What it is |
|---|---|
| `lib/kappy/sprite.json` | The packaged pixel data: every part, face and chest-screen icon as rows of letters |
| `scripts/kappy/sprite.mjs` | How the data is drawn (round parts rasterised, claws, faces and icons by hand). `npm run kappy:sprite` rewrites the JSON |
| `components/kappy/engine.ts` | `KappyEngine`: draws the sprite and plays its states |
| `components/kappy/Kappy.tsx` | `<Kappy>`, `<KappyBubble>` (its speech bubble), `<KappyIcon>` (a chest icon, for buttons and trace lines) |
| `components/kappy/KappyDock.tsx` | Kappy in the bottom-left corner of every page (mounted in `app/[lang]/layout.tsx`) |
| `components/kappy/KappyShowcase.tsx`, `app/[lang]/kappy/page.tsx` | `/kappy`: every state on a stage |
| `components/kappy/kappy.module.css` | All of Kappy's drawing and motion |
| `scripts/i18n/zh-hans/23-kappy.json` | Chinese for Kappy's lines |

## Use

```tsx
const kappy = useRef<KappyEngine | null>(null);
const bubble = useRef<HTMLDivElement>(null);

<Kappy ref={kappy} bubble={bubble} scale={3} />          // or acc="cap" / acc="case" for the two debate advisers
<KappyBubble ref={bubble} />

kappy.current?.set("think");                              // idle | listen | think | blocked | human | done
kappy.current?.say(t("Checking the Employment Pass minimum salary…"));
```

Size: `scale` (1 = 64 × 96), or `--kappy-scale` on any ancestor. Use whole numbers so the pixels stay sharp.

## Wiring it to the adviser v2 events (`docs/agent/debate-blueprint.md`)

| Event or moment | Call |
|---|---|
| The student types | `hear(inputElement)` on each keystroke |
| `thinking` | `set("think")`, then `say(event.text)` |
| `tool` | `showTool(icon)`: `search_programmes`/`admit_rate` → `"school"`, `hot_roles`/`skill_gap` → `"case"`, `ep_check` → `"pass"`, `outcomes_figures`/`compare_roads` → `"chart"` |
| A stage's `result` | `flash()` |
| Step 2 starts | hide the main Kappy (`away`), show two with `acc="cap"` and `acc="case"`; merge back for the judge |
| Audit `blocked` | `set("blocked")`, then `set("think")` while rewriting |
| Audit passed | `set("done")`, `light()` |
| Both audits failed | `set("human")` |
| Saved to the plan | `celebrate()` |

Motion stops (still frames only) when the system asks for reduced motion. The site's own "Pause animations" switch was removed on 2026-11-02.

The corner Kappy links to `/adviser`; on that page the dock hides (`body:has([data-kappy-stage])`) and Kappy stands on the roadmap's stage instead (`components/adviser/kappy-stage.tsx`, see `docs/agent/roadmap.md`).
