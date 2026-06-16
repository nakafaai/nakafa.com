import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
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

  return Effect.runPromise(
    getMaterialApiContentPage({
      ...pageParams,
      locale: validLocale,
      prefix,
    }).pipe(
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
