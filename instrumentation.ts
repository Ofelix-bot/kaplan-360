// Runs once when the server starts (Next.js instrumentation). It loads the programme list into the cache in the
// background, so the AI adviser's first programme search doesn't wait 10–15 s for it on a fresh instance.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getResultsData } = await import("@/lib/data/results");
  getResultsData().catch(() => {});
}
