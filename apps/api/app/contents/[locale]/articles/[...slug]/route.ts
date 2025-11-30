import {
  getContents,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { createServiceLogger, logError } from "@repo/utilities/logging";
import { NextResponse } from "next/server";

export const revalidate = false;

const logger = createServiceLogger("api-contents");

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames("articles");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // For each top directory (articles)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(`articles/${topDir}`);

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
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
) {
  const { locale, slug } = await params;

  const basePath = slug.join("/");

  const cleanPath = `articles/${basePath}` as const;

  try {
    const content = await getContents({
      locale,
      basePath: cleanPath,
    });

    return NextResponse.json(content);
  } catch (error) {
    logError(
      logger,
      error instanceof Error ? error : new Error(String(error)),
      {
        locale,
        basePath: basePath || "/",
        slugLength: slug.length,
        message: "Failed to fetch contents.",
      }
    );

    return NextResponse.json(
      { error: "Failed to fetch contents." },
      { status: 500 }
    );
  }
}
