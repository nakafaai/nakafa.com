import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getExercisesContent } from "@repo/contents/_lib/exercises/set";
import {
  hasInvalidTryOutYearSlug,
  isTryOutCollectionSlug,
  LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
} from "@repo/contents/_lib/exercises/slug";
import {
  getExerciseNumberPaths,
  getExerciseSetPaths,
} from "@repo/contents/_lib/params";
import { getScopedContent } from "@repo/contents/_lib/scoped";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
} from "@repo/contents/_shared/error";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { logError } from "@repo/utilities/logging/effect";
import { Effect, Option, Schema } from "effect";
import { NextResponse } from "next/server";

export const revalidate = false;

const EXERCISE_PREFIX_LEN = 3;
const EXERCISE_TYPE_INDEX = 0;
const LEGACY_TRY_OUT_SUFFIX_INDEX = 1;

/**
 * Only prerenders concrete exercise set and exercise number endpoints.
 * Folder-only prefixes under `exercises/` always 404 in this route and add a
 * large amount of pointless build work.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => {
    const mdxSlugs = getMDXSlugsForLocale(locale);
    const exercisePaths = [
      ...getExerciseSetPaths(mdxSlugs),
      ...getExerciseNumberPaths(mdxSlugs),
    ];

    return exercisePaths.map((exercisePath) => ({
      locale,
      slug: exercisePath.slice("exercises/".length).split("/"),
    }));
  });
}

/**
 * Returns exercise MDX fragments or parsed exercise sets for the API content
 * route under `/contents/:locale/exercises/*`.
 */
export async function GET(
  request: Request,
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

  // In this API route, `slug` is the catch-all part after
  // `/contents/{locale}/exercises/`:
  // [category, type, material, ...exerciseSlug]
  const exerciseRoutePrefix = slug.slice(0, EXERCISE_PREFIX_LEN);
  const relativeExerciseSlug = slug.slice(EXERCISE_PREFIX_LEN);
  const exerciseType = relativeExerciseSlug[EXERCISE_TYPE_INDEX];
  const legacyTryOutSuffix = relativeExerciseSlug.slice(
    LEGACY_TRY_OUT_SUFFIX_INDEX
  );

  if (
    exerciseType !== undefined &&
    hasInvalidTryOutYearSlug(relativeExerciseSlug) &&
    legacyTryOutSuffix.length > 0
  ) {
    // The API only serves concrete set/question endpoints, so redirect legacy
    // yearless try-out requests like `try-out/set-1` and `try-out/set-1/1`.
    const redirectUrl = new URL(request.url);
    const redirectedSlug = [
      ...exerciseRoutePrefix,
      exerciseType,
      LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
      ...legacyTryOutSuffix,
    ];

    redirectUrl.pathname = `/contents/${validLocale.value}/exercises/${redirectedSlug.join("/")}`;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (isTryOutCollectionSlug(relativeExerciseSlug)) {
    return NextResponse.json(
      { error: "Exercises content not found." },
      { status: 404 }
    );
  }

  let exerciseNumber: number | null = null;
  let rest = [...slug];
  let isQuestionOrAnswer = false;

  // Check if the last segment is _question or _answer
  if (rest.length > 0) {
    const lastSegment = rest.at(-1);
    if (lastSegment === "_question" || lastSegment === "_answer") {
      isQuestionOrAnswer = true;
      rest = rest.slice(0, -1);
    }
  }

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

  // If requesting _question or _answer MDX content directly
  if (isQuestionOrAnswer && exerciseNumber !== null) {
    const mdxPath = `exercises/${basePath}/${exerciseNumber}/${slug.at(-1)}`;

    const program = getScopedContent(
      "exercises",
      validLocale.value,
      mdxPath
    ).pipe(
      Effect.matchEffect({
        onFailure: (error: unknown) =>
          Effect.gen(function* () {
            const err =
              error instanceof Error ? error : new Error(String(error));

            yield* logError(err, {
              service: "api-exercises",
              locale: validLocale.value,
              mdxPath,
              message: "Failed to fetch MDX content.",
            });

            const statusCode =
              error instanceof InvalidPathError ||
              error instanceof FileReadError ||
              error instanceof MetadataParseError ||
              error instanceof GitHubFetchError
                ? 404
                : 500;

            return yield* Effect.succeed<Response>(
              NextResponse.json(
                { error: "Failed to fetch MDX content." },
                { status: statusCode }
              )
            );
          }),
        onSuccess: (data) => {
          if (!data) {
            return Effect.succeed<Response>(
              NextResponse.json(
                { error: "MDX content not found." },
                { status: 404 }
              )
            );
          }

          return Effect.succeed<Response>(NextResponse.json([data]));
        },
      })
    );

    return Effect.runPromise(program);
  }

  // Otherwise, fetch exercises data using the original logic
  const cleanPath = `exercises/${basePath}` as const;

  const program = Effect.matchEffect(
    getExercisesContent({
      locale: validLocale.value,
      filePath: cleanPath,
      includeMDX: false,
    }),
    {
      onFailure: (error: unknown) =>
        Effect.gen(function* () {
          const err = error instanceof Error ? error : new Error(String(error));

          yield* logError(err, {
            service: "api-exercises",
            locale: validLocale.value,
            basePath: basePath || "/",
            slugLength: slug.length,
            message: "Failed to fetch content.",
          });

          return yield* Effect.succeed<Response>(
            NextResponse.json(
              { error: "Failed to fetch exercises content." },
              { status: 500 }
            )
          );
        }),
      onSuccess: (content) => {
        if (content.length === 0) {
          return Effect.succeed<Response>(
            NextResponse.json(
              { error: "Exercises content not found." },
              { status: 404 }
            )
          );
        }

        const result =
          exerciseNumber === null
            ? content
            : content.filter((exercise) => exercise.number === exerciseNumber);

        if (exerciseNumber !== null && result.length === 0) {
          return Effect.succeed<Response>(
            NextResponse.json({ error: "Exercise not found." }, { status: 404 })
          );
        }

        return Effect.succeed<Response>(NextResponse.json(result));
      },
    }
  );

  return Effect.runPromise(program);
}
