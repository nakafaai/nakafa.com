import { getContents } from "@repo/contents/_lib/utils";

export async function GET(_req: Request) {
  const locale = "en";
  const contentSlug = "articles";

  const content = await getContents({
    locale,
    basePath: contentSlug,
  });

  return new Response(JSON.stringify(content, null, 2));
}
