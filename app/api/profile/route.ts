import Anthropic from "@anthropic-ai/sdk";
import { getDocumentProxy } from "unpdf";
import { readProfile, readProfileFromFiles, type ProfileFile } from "@/lib/profile-ai";
import { IMAGE_TYPES, MAX_FILES, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES, MAX_SENTENCE } from "@/lib/profile-reading";

// POST /api/profile {text}: the planner's fields read from one sentence (lib/profile-ai.ts). Only
// this site's own pages may call it, a few times a minute per visitor; the sentence is neither
// stored nor logged. Answers: 200 {patch, budgetFrom, field}, or {error} with 400 / 403 / 413 /
// 429 / 502 / 503 ("unavailable": no API key on this deployment).
// POST multipart/form-data (text, file × up to 3): the same, read from screenshots and PDFs as well.
// Files are read and dropped, never stored or logged; their own limit is 10 reads per 10 minutes.
// Extra errors: "too-many-files", "bad-file", "too-big" (413), "too-many-pages" (413), "encrypted" (400).

const WINDOW_MS = 60_000;
const PER_WINDOW = 6;
const PER_DAY = 40;
const FILES_WINDOW_MS = 600_000;
const FILES_PER_WINDOW = 10;
/** Requests per visitor address on this server instance: best effort, it resets when the instance does. */
const seen = new Map<string, number[]>();
const seenFiles = new Map<string, number[]>();

function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (seen.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  if (recent.filter((t) => now - t < WINDOW_MS).length >= PER_WINDOW || recent.length >= PER_DAY) return false;
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) seen.delete(seen.keys().next().value!);
  return true;
}

function allowFiles(ip: string): boolean {
  const now = Date.now();
  const recent = (seenFiles.get(ip) ?? []).filter((t) => now - t < FILES_WINDOW_MS);
  if (recent.length >= FILES_PER_WINDOW) return false;
  recent.push(now);
  seenFiles.set(ip, recent);
  if (seenFiles.size > 5000) seenFiles.delete(seenFiles.keys().next().value!);
  return true;
}

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

class FileError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** One uploaded file as the model takes it, or a FileError. The type is read from the bytes, not the name. */
async function toProfileFile(file: File): Promise<ProfileFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = Array.from(bytes.slice(0, 12), (b) => String.fromCharCode(b)).join("");
  if (head.startsWith("%PDF-")) {
    if (bytes.length > MAX_PDF_BYTES) throw new FileError("too-big", 413);
    let pages: number;
    try {
      pages = (await getDocumentProxy(bytes.slice())).numPages;
    } catch (e) {
      throw e instanceof Error && e.name === "PasswordException" ? new FileError("encrypted", 400) : new FileError("bad-file", 400);
    }
    if (pages > MAX_PDF_PAGES) throw new FileError("too-many-pages", 413);
    return { mediaType: "application/pdf", data: Buffer.from(bytes).toString("base64") };
  }
  const mediaType = head.startsWith("\x89PNG") ? "image/png" : head.startsWith("\xFF\xD8\xFF") ? "image/jpeg" : head.startsWith("RIFF") && head.slice(8) === "WEBP" ? "image/webp" : null;
  if (!mediaType || !(IMAGE_TYPES as readonly string[]).includes(mediaType)) throw new FileError("bad-file", 400);
  if (bytes.length > MAX_IMAGE_BYTES) throw new FileError("too-big", 413);
  return { mediaType, data: Buffer.from(bytes).toString("base64") };
}

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return reply({ error: "unavailable" }, 503);
  // The site's own pages only: the browser always sends Origin on a POST from a page.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameSite = false;
  try {
    sameSite = !!origin && !!host && new URL(origin).host === host;
  } catch {}
  if (!sameSite) return reply({ error: "forbidden" }, 403);
  const ip = request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const withFiles = request.headers.get("content-type")?.startsWith("multipart/form-data") ?? false;
  if (!(withFiles ? allowFiles(ip) : allow(ip))) return reply({ error: "busy" }, 429);

  let text: unknown;
  let uploads: File[] = [];
  try {
    if (withFiles) {
      const form = await request.formData();
      text = form.get("text") ?? "";
      uploads = form.getAll("file").filter((f): f is File => f instanceof File);
    } else ({ text } = (await request.json()) as { text?: unknown });
  } catch {
    return reply({ error: "bad-request" }, 400);
  }
  if (typeof text !== "string" || (!text.trim() && !uploads.length)) return reply({ error: "bad-request" }, 400);
  if (text.length > MAX_SENTENCE) return reply({ error: "too-long" }, 413);
  if (uploads.length > MAX_FILES) return reply({ error: "too-many-files" }, 413);

  let files: ProfileFile[] = [];
  try {
    files = await Promise.all(uploads.map(toProfileFile));
  } catch (e) {
    if (e instanceof FileError) return reply({ error: e.code }, e.status);
    return reply({ error: "bad-file" }, 400);
  }

  try {
    return reply(files.length ? await readProfileFromFiles(files, text.trim(), key) : await readProfile(text.trim(), key));
  } catch (e) {
    // The error's kind only: never the sentence or the files.
    console.error("profile: model call failed", e instanceof Anthropic.APIError ? e.status : e instanceof Error ? e.name : "unknown");
    return reply({ error: e instanceof Anthropic.RateLimitError ? "busy" : "failed" }, e instanceof Anthropic.RateLimitError ? 429 : 502);
  }
}
