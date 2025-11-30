import {
  getExercisesContent,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { createServiceLogger, logError } from "@repo/utilities/logging";
import { NextResponse } from "next/server";

export const revalidate = false;

const logger = createServiceLogger("api-exercises");

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames("exercises");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // For each top directory (exercises)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(`exercises/${topDir}`);

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

  let exerciseNumber: number | null = null;
  let rest = [...slug];

  // Capture and remove trailing number if it exists (exercise number like 1, 2, 3)
  if (rest.length > 0) {
    const lastSegment = rest.at(-1);
    if (lastSegment) {
      const parsedNumber = Number.parseInt(lastSegment, 10);
      const isNumber = !Number.isNaN(parsedNumber);
      if (isNumber) {
        exerciseNumber = parsedNumber;
        rest = rest.slice(0, -1);
      }
    }
  }

  const basePath = rest.join("/");

  const cleanPath = `exercises/${basePath}` as const;

  try {
    const content = await getExercisesContent(locale, cleanPath);

    if (!content) {
      return NextResponse.json(
        { error: "Exercises content not found." },
        { status: 404 }
      );
    }

    // Filter to specific exercise if number was provided
    const result =
      exerciseNumber !== null
        ? content.filter((exercise) => exercise.number === exerciseNumber)
        : content;

    // Always return an array, even if filtered result is empty
    if (exerciseNumber !== null && result.length === 0) {
      return NextResponse.json(
        { error: "Exercise not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logError(
      logger,
      error instanceof Error ? error : new Error(String(error)),
      {
        locale,
        basePath: basePath || "/",
        slugLength: slug.length,
        message: "Failed to fetch content.",
      }
    );

    return NextResponse.json(
      { error: "Failed to fetch exercises content." },
      { status: 500 }
    );
  }
}
