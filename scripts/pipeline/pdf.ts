import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config";

// Text of a PDF, page by page, through PDF.js (unpdf). The character maps for Chinese, Japanese and
// Korean fonts come from pdfjs-dist, so reports in Chinese read as text rather than empty boxes.

// PDF.js wants forward slashes and a trailing slash, also on Windows.
const dir = (...p: string[]) => path.join(ROOT, "node_modules", "pdfjs-dist", ...p).split(path.sep).join("/") + "/";
const CMAPS = dir("cmaps");
const FONTS = dir("standard_fonts");

export async function pdfPages(file: string): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)), { cMapUrl: CMAPS, cMapPacked: true, standardFontDataUrl: FONTS });
  const { text } = await extractText(pdf, { mergePages: false });
  return text as string[];
}
