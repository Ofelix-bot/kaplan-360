import path from "node:path";

// Settings shared by the programme-data pipeline (see README → "Programme data pipeline").
// Adapted from the v1 demo's pipeline; no v1 data is reused.

/** Product token used for robots.txt matching. */
export const BOT_TOKEN = "Kaplan360ppDataPipeline";
export const CONTACT = process.env.PIPELINE_CONTACT ?? "Kaplan 360++ prototype, AI For Impact 2026";
export const USER_AGENT = `${BOT_TOKEN}/0.2 (+${CONTACT}; course-data collection from official pages; low request rate)`;

/** Minimum gap between two requests to the same host. A longer robots.txt Crawl-delay wins. */
export const MIN_INTERVAL_MS = Number(process.env.PIPELINE_INTERVAL_MS ?? 2500);
/** Crawl-delays up to this are honoured (Monash asks for 30 s); longer ones are recorded and skipped. A one-off run for a
 *  slow site can honour more (PIPELINE_MAX_CRAWL_DELAY_S=150 for Stony Brook’s 120 s). */
export const MAX_CRAWL_DELAY_S = Number(process.env.PIPELINE_MAX_CRAWL_DELAY_S ?? 60);
export const TIMEOUT_MS = 25_000;
export const RETRIES = 3;
/** Pages fetched in parallel across different hosts (always one at a time per host). 14 from 2026-11-01 (was 8). */
export const HOST_CONCURRENCY = 14;
/** A cached page younger than this is reused; `--refresh` fetches again. */
export const CACHE_MAX_AGE_DAYS = 30;

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const DATA_DIR = path.join(ROOT, "data", "pipeline");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");
export const FETCH_LOG_FILE = path.join(DATA_DIR, "fetch-log.json");
export const EXTRACTED_FILE = path.join(DATA_DIR, "extracted.json");
export const AI_FILE = path.join(DATA_DIR, "ai-extracted.json");
export const REPORT_MD = path.join(DATA_DIR, "report.md");
/** Curated output, loaded into Supabase by scripts/data/load-supabase.mjs. */
export const OUTPUT_FILE = path.join(ROOT, "data", "raw", "programmes.json");
export const INSTITUTIONS_FILE = path.join(ROOT, "data", "raw", "institutions.json");

/** Claude model for extraction (extract-ai.ts, english-university.ts). */
export const AI_MODEL = "claude-haiku-5-5";
/** University-wide English minimums (english-university.ts). */
export const UNIVERSITY_ENGLISH_FILE = path.join(DATA_DIR, "english-university.json");
