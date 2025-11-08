import {
  getContents,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { createServiceLogger, logError } from "@repo/utilities/logging";
import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";

const logger = createServiceLogger("api-contents");

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    result.push({
      slug: [locale],
    });

    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself
      result.push({
        slug: [locale, topDir],
      });

      // Add each nested path
      for (const path of nestedPaths) {
        result.push({
          slug: [locale, topDir, ...path],
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

  let locale = "en";
  let basePath = "";

  if (slug.length >= 2) {
    locale = slug.at(0) ?? "en";
    basePath = slug.slice(1).join("/");
  }

  try {
    const content = await fetchContents(locale, basePath);

    return NextResponse.json(content);
  } catch (error) {
    logError(
      logger,
      error instanceof Error ? error : new Error(String(error)),
      {
        locale,
        basePath: basePath || "/",
        slugLength: slug.length,
        message: "Failed to fetch content",
      }
    );

    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

async function fetchContents(locale: string, basePath: string) {
  "use cache";
  cacheLife("max");
  const content = await getContents({
    locale,
    basePath,
  });
  return content;
}
