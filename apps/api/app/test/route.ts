import { getContent, getNestedSlugs } from "@repo/contents/_lib/utils";

export const revalidate = false;

export async function GET(_req: Request) {
  const result: { slug: string[] }[] = [];
  for (const topDir of ["subject"]) {
    // Get all nested paths starting from this folder
    const nestedPaths = getNestedSlugs(topDir);

    // Add the top-level folder itself
    result.push({
      slug: [topDir],
    });

    // Add each nested path
    for (const path of nestedPaths) {
      result.push({
        slug: [topDir, ...path],
      });
    }
  }

  const promises = result.map(async (item) => {
    const content = await getContent("en", item.slug.join("/"));
    if (!content) {
      return null;
    }

    return {
      ...content.metadata,
      url: `/en/${item.slug.join("/")}`,
    };
  });

  const contents = await Promise.all(promises).then((results) =>
    results.filter((item) => item !== null)
  );

  return new Response(JSON.stringify(contents, null, 2));
}
