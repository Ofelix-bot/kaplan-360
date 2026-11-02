import kaplan from "@/data/raw/kaplan-programmes.json";
import { getPrepareSteps } from "@/lib/data/results";

// "How should I prepare?" steps for one discipline, loaded the first time a student opens one: the
// request names a field only, never the student's answers.
export function generateStaticParams() {
  return Object.keys(kaplan.disciplines).map((discipline) => ({ discipline }));
}

export async function GET(_req: Request, { params }: RouteContext<"/data/prepare/[discipline]">) {
  const { discipline } = await params;
  if (!(discipline in kaplan.disciplines)) return Response.json({}, { status: 404 });
  return Response.json(await getPrepareSteps(discipline));
}
