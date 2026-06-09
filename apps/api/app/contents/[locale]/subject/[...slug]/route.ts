import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
  formatApiContentPageResponse,
  getSubjectApiContentPage,
  hasApiPaginationParams,
  listApiStaticParams,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

export const revalidate = false;

/**
 * Generates all locale-aware subject API paths from the Convex route catalog.
 */
export function generateStaticParams() {
  return listApiStaticParams({
    prefix: "subject/",
    section: "subject",
  });
}

/**
 * Returns subject content lists for `/contents/:locale/subject/*`.
 */
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

  const prefix = `subject/${slug.join("/")}`;
  const paginated = hasApiPaginationParams(searchParams);

  return Effect.runPromise(
    getSubjectApiContentPage({
      ...pageParams,
      locale: validLocale,
      prefix,
    }).pipe(
      Effect.map((data): Response => {
        const response = formatApiContentPageResponse({
          page: data,
          paginated,
        });

        if (response.kind === "tooLarge") {
          return NextResponse.json(response.data, { status: response.status });
        }

        return NextResponse.json(response.data);
      }),
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
