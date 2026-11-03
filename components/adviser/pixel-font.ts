import { Silkscreen } from "next/font/google";

// The pixel face of Kappy's design language (docs/agent/kappy.md), loaded only by /adviser: step labels, step numbers,
// counts and the eyebrow. Latin only; Chinese falls back to the display face (adviser.module.css .pix).
export const pixelFont = Silkscreen({ weight: "400", subsets: ["latin"], variable: "--font-pixel", display: "swap" });
