import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
  getExerciseApiQuestionPage,
  getExerciseApiSetPage,
  getMaterialApiContentPage,
  listApiStaticParams,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

export const revalidate = false;

const PRACTICE_QUESTION_SEGMENT_PATTERN = /^(?:question|soal)-(\d+)$/;

/** Generates all locale-aware material API paths from the Convex route catalog. */
export function generateStaticParams() {
  return listApiStaticParams({
    prefix: "material/",
    section: "material",
  });
}

/** Returns material content lists for `/contents/:locale/material/*`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
): Promise<Response> {
  const { locale, slug } = await params;
  const validLocale = parseApiLocale(locale);

  if (!validLocale) {
    return NextResponse.json(
      { error: "Invalid locale. Must be 'en' or 'id'." },
      { status: 400 }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const pageParams = parseApiPageParams(searchParams);

  if (!pageParams) {
    return NextResponse.json(
      { error: "Invalid pagination. Limit must be between 1 and 100." },
      { status: 400 }
    );
  }

  const prefix = `material/${slug.join("/")}`;
  const apiPage = getMaterialApiPage({
    ...pageParams,
    locale: validLocale,
    prefix,
  });

  return runMaterialApiRead(apiPage, { locale, slug });
}

/** Routes unified material API requests to the runtime table that owns the row. */
function getMaterialApiPage({
  cursor,
  limit,
  locale,
  prefix,
}: {
  cursor: string | null;
  limit: number;
  locale: NonNullable<ReturnType<typeof parseApiLocale>>;
  prefix: string;
}): Effect.Effect<unknown, Error, never> {
  const practiceRequest = readPracticeApiRequest(prefix);

  if (practiceRequest?.kind === "question") {
    return getExerciseApiQuestionPage({
      locale,
      slug: practiceRequest.slug,
    });
  }

  if (practiceRequest?.kind === "set") {
    return getExerciseApiSetPage({
      locale,
      slug: practiceRequest.slug,
    });
  }

  return getMaterialApiContentPage({
    cursor,
    limit,
    locale,
    prefix,
  });
}

/** Converts one content-runtime read into the shared material API response shape. */
function runMaterialApiRead(
  apiPage: Effect.Effect<unknown, Error, never>,
  {
    locale,
    slug,
  }: {
    locale: string;
    slug: readonly string[];
  }
) {
  return Effect.runPromise(
    apiPage.pipe(
      Effect.map((data): Response => NextResponse.json(data)),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* logError(error, {
            service: "api-contents",
            locale,
            basePath: slug.join("/") || "/",
            slugLength: slug.length,
            message: "Failed to fetch contents.",
          });

          return NextResponse.json(
            { error: "Failed to fetch contents." },
            { status: 500 }
          );
        })
      )
    )
  );
}

/** Classifies material/practice source prefixes into exercise set or question rows. */
function readPracticeApiRequest(prefix: string) {
  if (!prefix.startsWith("material/practice/")) {
    return;
  }

  const segments = prefix.split("/");
  const questionSegment = segments.at(-1);
  const questionMatch = questionSegment?.match(
    PRACTICE_QUESTION_SEGMENT_PATTERN
  );

  if (questionMatch?.[1]) {
    return {
      kind: "question" as const,
      slug: [...segments.slice(0, -1), questionMatch[1]].join("/"),
    };
  }

  return {
    kind: "set" as const,
    slug: prefix,
  };
}
