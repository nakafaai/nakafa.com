import {
  readPublicPracticeQuestionNumber,
  readSourcePracticeQuestionNumber,
} from "@repo/contents/_types/route/practice";
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
}) {
  const practiceRequest = readPracticeApiRequest({ locale, prefix });

  if (practiceRequest?.kind === "question") {
    return {
      kind: "question" as const,
      page: getExerciseApiQuestionPage({
        locale,
        slug: practiceRequest.slug,
      }),
    };
  }

  if (practiceRequest?.kind === "set") {
    return {
      kind: "set" as const,
      page: getExerciseApiSetPage({
        locale,
        slug: practiceRequest.slug,
      }),
    };
  }

  return {
    kind: "list" as const,
    page: getMaterialApiContentPage({
      cursor,
      limit,
      locale,
      prefix,
    }),
  };
}

/** Converts one content-runtime read into the shared material API response shape. */
function runMaterialApiRead(
  apiRead: ReturnType<typeof getMaterialApiPage>,
  {
    locale,
    slug,
  }: {
    locale: string;
    slug: readonly string[];
  }
) {
  const onError = (error: Parameters<typeof logError>[0]) =>
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
    });

  if (apiRead.kind === "list") {
    return Effect.runPromise(
      apiRead.page.pipe(
        Effect.map((data): Response => NextResponse.json(data)),
        Effect.catchAll(onError)
      )
    );
  }

  if (apiRead.kind === "question") {
    return Effect.runPromise(
      apiRead.page.pipe(
        Effect.map((data): Response => readExactMaterialApiResponse(data)),
        Effect.catchAll(onError)
      )
    );
  }

  return Effect.runPromise(
    apiRead.page.pipe(
      Effect.map((data): Response => readExactMaterialApiResponse(data)),
      Effect.catchAll(onError)
    )
  );
}

/** Converts exact exercise content rows to JSON while preserving missing rows as 404s. */
function readExactMaterialApiResponse<T>(data: T | null) {
  if (data === null) {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

/** Classifies material/practice source prefixes into exercise set or question rows. */
function readPracticeApiRequest({
  locale,
  prefix,
}: {
  locale: NonNullable<ReturnType<typeof parseApiLocale>>;
  prefix: string;
}) {
  if (!prefix.startsWith("material/practice/")) {
    return;
  }

  const segments = prefix.split("/");
  const questionSegment = segments.at(-1);
  const questionNumber =
    readPublicPracticeQuestionNumber({
      locale,
      segment: questionSegment,
    }) ?? readSourcePracticeQuestionNumber(questionSegment);

  if (questionNumber !== null) {
    return {
      kind: "question" as const,
      slug: [...segments.slice(0, -1), questionNumber.toString()].join("/"),
    };
  }

  return {
    kind: "set" as const,
    slug: prefix,
  };
}
