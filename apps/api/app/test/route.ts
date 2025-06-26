import { getContents } from "@repo/contents/_lib/utils";

export const revalidate = false;

export async function GET(_req: Request) {
  const contents = await getContents({
    locale: "en",
    basePath: "subject",
  });

  return new Response(JSON.stringify(contents, null, 2));
}
