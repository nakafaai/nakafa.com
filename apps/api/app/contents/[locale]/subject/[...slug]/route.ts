import { generateContentParams } from "@repo/contents/_lib/params";
import { getSubjectContents } from "@repo/contents/_lib/subject/content";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
} from "@repo/contents/_shared/error";
import { LocaleSchema } from "@repo/contents/_types/content";
import { logError } from "@repo/utilities/logging/effect";
import { Effect, Option, Schema } from "effect";
import { NextResponse } from "next/server";

export const revalidate = false;

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

  const validLocale = Schema.decodeUnknownOption(LocaleSchema)(locale);
  if (Option.isNone(validLocale)) {
    return NextResponse.json(
      { error: "Invalid locale. Must be 'en' or 'id'." },
      { status: 400 }
    );
  }

  const basePath = slug.join("/");
  const cleanPath = `subject/${basePath}` as const;

  return Effect.runPromise(
    getSubjectContents({
      locale: validLocale.value,
      basePath: cleanPath,
      includeMDX: false,
    }).pipe(
      Effect.matchEffect({
        onFailure: (error: unknown) =>
          Effect.gen(function* () {
            const err =
              error instanceof Error ? error : new Error(String(error));

            yield* logError(err, {
              service: "api-contents",
              locale,
              basePath: basePath || "/",
              slugLength: slug.length,
              message: "Failed to fetch contents.",
            });

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
          }),
        onSuccess: (data) => Effect.succeed(NextResponse.json(data)),
      })
    )
  );
}
