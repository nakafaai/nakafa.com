import type { Locale } from "@repo/utilities/locales";
import { logError } from "@repo/utilities/logging/effect";
import { Effect, Option } from "effect";
import { NextResponse } from "next/server";
import {
  getExerciseApiQuestionPage,
  getExerciseApiSetPage,
  parseApiLocale,
} from "@/lib/content/runtime";

export const dynamic = "force-dynamic";
export const revalidate = false;

const EXERCISE_PREFIX_LEN = 3;
const EXERCISE_TYPE_INDEX = 0;
const LEGACY_TRY_OUT_SUFFIX_INDEX = 1;
const LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR = "2026";
const EXERCISES_ROUTE_ROOT = "exercises";
const TRY_OUT_SEGMENT = "try-out";
const EXERCISE_YEAR_SEGMENT_REGEX = /^\d{4}$/;

/**
 * Returns exercise fragments or parsed exercise rows for `/contents/:locale/exercises/*`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
) {
  const { locale, slug } = await params;
  const validLocale = parseApiLocale(locale);

  if (!validLocale) {
    return NextResponse.json(
      { error: "Invalid locale. Must be 'en' or 'id'." },
      { status: 400 }
    );
  }

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
    const redirectUrl = new URL(request.url);
    const redirectedSlug = [
      ...exerciseRoutePrefix,
      exerciseType,
      LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
      ...legacyTryOutSuffix,
    ];

    redirectUrl.pathname = `/contents/${validLocale}/exercises/${redirectedSlug.join("/")}`;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (isTryOutCollectionSlug(relativeExerciseSlug)) {
    return NextResponse.json(
      { error: "Exercises content not found." },
      { status: 404 }
    );
  }

  const target = getExerciseApiTarget(slug);

  return Effect.runPromise(
    readExerciseApiTarget({ locale: validLocale, target }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* logError(toError(error), {
            service: "api-exercises",
            locale: validLocale,
            basePath: target.setSlug || "/",
            slugLength: slug.length,
            message: "Failed to fetch exercises content.",
          });

          return NextResponse.json(
            { error: "Failed to fetch exercises content." },
            { status: 500 }
          );
        })
      )
    )
  );
}

interface ExerciseApiTarget {
  fragment: "_answer" | "_question" | null;
  number: Option.Option<number>;
  setSlug: string;
}

/** Parses the exercise API catch-all slug into a set, number, and fragment target. */
function getExerciseApiTarget(slug: readonly string[]): ExerciseApiTarget {
  let rest = [...slug];
  let fragment: ExerciseApiTarget["fragment"] = null;

  const lastSegment = rest.at(-1);
  if (lastSegment === "_question" || lastSegment === "_answer") {
    fragment = lastSegment;
    rest = rest.slice(0, -1);
  }

  const maybeNumber = rest.at(-1);
  if (!(maybeNumber && isExerciseNumberSegment(maybeNumber))) {
    return {
      fragment,
      number: Option.none(),
      setSlug: rest.join("/"),
    };
  }

  return {
    fragment,
    number: Option.some(Number.parseInt(maybeNumber, 10)),
    setSlug: rest.slice(0, -1).join("/"),
  };
}

/** Reads the parsed exercise API target from Convex and formats the legacy JSON shape. */
function readExerciseApiTarget({
  locale,
  target,
}: {
  locale: Locale;
  target: ExerciseApiTarget;
}): Effect.Effect<Response, unknown> {
  if (target.fragment && Option.isSome(target.number)) {
    return readExerciseFragment({
      fragment: target.fragment,
      locale,
      number: target.number.value,
      setSlug: target.setSlug,
    });
  }

  if (Option.isSome(target.number)) {
    return readExerciseQuestion({
      locale,
      number: target.number.value,
      setSlug: target.setSlug,
    });
  }

  return readExerciseSet({ locale, setSlug: target.setSlug });
}

/** Reads one direct question or answer fragment from a Convex exercise question row. */
function readExerciseFragment({
  fragment,
  locale,
  number,
  setSlug,
}: {
  fragment: "_answer" | "_question";
  locale: Locale;
  number: number;
  setSlug: string;
}): Effect.Effect<Response, unknown> {
  return Effect.gen(function* () {
    const page = yield* getExerciseApiQuestionPage({
      locale,
      slug: toExerciseRuntimeSlug(`${setSlug}/${number}`),
    });

    if (!page) {
      return NextResponse.json(
        { error: "MDX content not found." },
        { status: 404 }
      );
    }

    const fragmentContent =
      fragment === "_answer" ? page.exercise.answer : page.exercise.question;

    return NextResponse.json([fragmentContent]);
  });
}

/** Reads one exercise question from Convex and returns the legacy array shape. */
function readExerciseQuestion({
  locale,
  number,
  setSlug,
}: {
  locale: Locale;
  number: number;
  setSlug: string;
}): Effect.Effect<Response, unknown> {
  return Effect.gen(function* () {
    const page = yield* getExerciseApiQuestionPage({
      locale,
      slug: toExerciseRuntimeSlug(`${setSlug}/${number}`),
    });

    if (!page) {
      return NextResponse.json(
        { error: "Exercise not found." },
        { status: 404 }
      );
    }

    return NextResponse.json([page.exercise]);
  });
}

/** Reads one exercise set from Convex and returns its exercise array. */
function readExerciseSet({
  locale,
  setSlug,
}: {
  locale: Locale;
  setSlug: string;
}): Effect.Effect<Response, unknown> {
  return Effect.gen(function* () {
    const page = yield* getExerciseApiSetPage({
      locale,
      slug: toExerciseRuntimeSlug(setSlug),
    });

    if (!page) {
      return NextResponse.json(
        { error: "Exercises content not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(page.exercises);
  });
}

/** Returns true when a relative exercise slug points to a try-out collection page. */
function isTryOutCollectionSlug(slug: readonly string[]) {
  return (
    (slug.length === 1 && slug[0] === TRY_OUT_SEGMENT) ||
    (slug.length === 2 &&
      slug[0] === TRY_OUT_SEGMENT &&
      isExerciseYearSegment(slug.at(1)))
  );
}

/** Returns true for legacy try-out slugs that omitted the explicit year segment. */
function hasInvalidTryOutYearSlug(slug: readonly string[]) {
  return slug[0] === TRY_OUT_SEGMENT && !isExerciseYearSegment(slug.at(1));
}

/** Checks whether one route segment is a valid 4-digit exercise year. */
function isExerciseYearSegment(value: string | undefined) {
  return value !== undefined && EXERCISE_YEAR_SEGMENT_REGEX.test(value);
}

/** Checks whether one route segment is exactly a positive exercise number. */
function isExerciseNumberSegment(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return false;
  }

  const number = Number.parseInt(trimmedValue, 10);

  return number > 0 && number.toString() === trimmedValue;
}

/** Converts a public exercise API slug into the Convex route-catalog slug. */
function toExerciseRuntimeSlug(slug: string) {
  if (slug === "") {
    return EXERCISES_ROUTE_ROOT;
  }

  return `${EXERCISES_ROUTE_ROOT}/${slug}`;
}

/** Converts unknown Effect failures into real Error values for structured logging. */
function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
