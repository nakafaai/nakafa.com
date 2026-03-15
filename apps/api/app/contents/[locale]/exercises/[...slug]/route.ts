import { getContent } from "@repo/contents/_lib/content";
import { getExercisesContent } from "@repo/contents/_lib/exercises";
import { isTryOutCollectionSlug } from "@repo/contents/_lib/exercises/slug";
import { generateContentParams } from "@repo/contents/_lib/static-params";
import {
  ChoicesValidationError,
  ExerciseLoadError,
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

const logger = createServiceLogger("api-exercises");

export function generateStaticParams() {
  return generateContentParams({
    basePath: "exercises",
  }).filter((params) => !isTryOutCollectionSlug(params.slug.slice(3)));
}

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

  if (isTryOutCollectionSlug(slug.slice(3))) {
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

    const program = Effect.match(getContent(validLocale, mdxPath), {
      onFailure: (error: unknown) => {
        logError(
          logger,
          error instanceof Error ? error : new Error(String(error)),
          {
            locale: validLocale,
            mdxPath,
            message: "Failed to fetch MDX content.",
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
          { error: "Failed to fetch MDX content." },
          { status: statusCode }
        );
      },
      onSuccess: (data) => {
        if (!data) {
          return NextResponse.json(
            { error: "MDX content not found." },
            { status: 404 }
          );
        }
        return NextResponse.json([data]);
      },
    });

    return Effect.runPromise(program);
  }

  // Otherwise, fetch exercises data using the original logic
  const cleanPath = `exercises/${basePath}` as const;

  const program = Effect.match(
    getExercisesContent({
      locale: validLocale,
      filePath: cleanPath,
      includeMDX: false,
    }),
    {
      onFailure: (error: unknown) => {
        logError(
          logger,
          error instanceof Error ? error : new Error(String(error)),
          {
            locale: validLocale,
            basePath: basePath || "/",
            slugLength: slug.length,
            message: "Failed to fetch content.",
          }
        );

        const statusCode =
          error instanceof ExerciseLoadError ||
          error instanceof ChoicesValidationError
            ? 500
            : 500;

        return NextResponse.json(
          { error: "Failed to fetch exercises content." },
          { status: statusCode }
        );
      },
      onSuccess: (content) => {
        if (content.length === 0) {
          return NextResponse.json(
            { error: "Exercises content not found." },
            { status: 404 }
          );
        }

        const result =
          exerciseNumber === null
            ? content
            : content.filter(
                (exercise: { number: number }) =>
                  exercise.number === exerciseNumber
              );

        if (exerciseNumber !== null && result.length === 0) {
          return NextResponse.json(
            { error: "Exercise not found." },
            { status: 404 }
          );
        }

        return NextResponse.json(result);
      },
    }
  );

  return Effect.runPromise(program);
}
