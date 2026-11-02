import { getResultsData } from "@/lib/data/results";

// One static file with every programme, for /results to match in the browser (the student's
// answers are never sent anywhere). Rebuilt on deploy and refreshed hourly from Supabase.
export async function GET() {
  return Response.json(await getResultsData());
}
