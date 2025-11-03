import {
  getContents,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import {
  createServiceLogger,
  createTimer,
  logError,
} from "@repo/utilities/logging";
import { NextResponse } from "next/server";

export const revalidate = false;

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

  const requestContext = {
    locale,
    basePath: basePath || "/",
    slugLength: slug.length,
  };

  logger.info(requestContext, "Fetching content");

  const endTimer = createTimer(logger, "get-contents", requestContext);

  try {
    const content = await getContents({
      locale,
      basePath,
    });

    const duration = endTimer();

    logger.info(
      {
        ...requestContext,
        duration,
        hasContent: !!content,
      },
      "Content fetched successfully"
    );

    return NextResponse.json(content);
  } catch (error) {
    endTimer();

    logError(
      logger,
      error instanceof Error ? error : new Error(String(error)),
      {
        ...requestContext,
        message: "Failed to fetch content",
      }
    );

    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
