import { getContent } from "@repo/contents/_lib/utils";

export async function GET() {
  const content = await getContent(
    "en",
    "subject/university/bachelor/ai-ds/linear-methods/determinant-calculation"
  ).then((c) => {
    if (!c) {
      return null;
    }
    return c.raw.slice(0, 100);
  });

  return Response.json({
    date: new Date().toISOString(),
    content,
  });
}
