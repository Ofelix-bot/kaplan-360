import file from "@/data/raw/read-count.json";

// How much Kaplan 360++ read (data/raw/read-count.json, counted 2026-11-02 from the pipeline's fetch logs, the
// session records and the API job logs): every page fetch and every API call, a page read twice counted twice.
// The homepage's pages line, the "How AI is used" tile and /move's Sources card show it.

export type ReadCount = {
  note: string;
  builtAt: string;
  /** YYYY-MM-DD: the first and the latest read. */
  first: string;
  latest: string;
  pages: { pipeline: number; sitemaps: number; other: number; total: number };
  api: { claude: number; openData: number; total: number };
  /** Pages plus API calls. */
  total: number;
};

export const getReadCount = (): ReadCount => file as ReadCount;
