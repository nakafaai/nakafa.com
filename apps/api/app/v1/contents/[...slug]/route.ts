import {
  getContents,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself
      result.push({
        locale,
        slug: [topDir],
      });

      // Add each nested path
      for (const path of nestedPaths) {
        result.push({
          locale,
          slug: [topDir, ...path],
        });
      }
    }
  }

  return result;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  const locale = slug.at(0) ?? "en";
  const contentSlug = slug.slice(1).join("/");

  const content = await getContents({
    locale,
    basePath: contentSlug,
  });

  return NextResponse.json(content);
}
