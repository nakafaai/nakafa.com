import { generateContentParams } from "@repo/contents/_lib/params";
import { getSubjectContents } from "@repo/contents/_lib/subject/content";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
} from "@repo/contents/_shared/error";
import { LocaleSchema } from "@repo/contents/_types/content";
import { createServiceLogger, logError } from "@repo/utilities/logging";
import { Effect } from "effect";
import { NextResponse } from "next/server";

export const revalidate = false;

const logger = createServiceLogger("api-contents");

/**
 * Generates all locale-aware subject API paths under `/contents/:locale/subject/*`.
 */
export function generateStaticParams() {
  return generateContentParams({
    basePath: "subject",
  });
}

/**
 * Returns subject content lists for the API content route under
 * `/contents/:locale/subject/*`.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
) {
  const { locale, slug } = await params;

  const parseResult = LocaleSchema.safeParse(locale);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid locale. Must be 'en' or 'id'." },
      { status: 400 }
    );
  }

  const validLocale = parseResult.data;
  const basePath = slug.join("/");

  const cleanPath = `subject/${basePath}` as const;

  const program = getSubjectContents({
    locale: validLocale,
    basePath: cleanPath,
    includeMDX: false,
  });

  const response = await Effect.runPromise(
    Effect.match(program, {
      onFailure: (error: unknown) => {
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

        const statusCode =
          error instanceof InvalidPathError ||
          error instanceof FileReadError ||
          error instanceof MetadataParseError ||
          error instanceof GitHubFetchError
            ? 404
            : 500;

        return NextResponse.json(
          { error: "Failed to fetch contents." },
          { status: statusCode }
        );
      },
      onSuccess: (data) => NextResponse.json(data),
    })
  );

  return response;
}
