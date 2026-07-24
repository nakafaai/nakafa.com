import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
  getApiPublishedContent,
  invalidApiLocaleMessage,
  parseApiLocale,
} from "@/lib/content/runtime";

export const dynamic = "force-dynamic";

/**
 * Returns one exact signed article for `/contents/:locale/articles/*`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string[] }> }
): Promise<Response> {
  const { locale, slug } = await params;
  const validLocale = parseApiLocale(locale);

  if (!validLocale) {
    return NextResponse.json(
      { error: invalidApiLocaleMessage },
      { status: 400 }
    );
  }

  const publicPath = `articles/${slug.join("/")}`;

  return Effect.runPromise(
    getApiPublishedContent({
      expected: "article",
      locale: validLocale,
      publicPath,
    }).pipe(
      Effect.map((data): Response => NextResponse.json(data)),
      Effect.catchTag("PublicContentMissingError", () =>
        Effect.succeed(
          NextResponse.json({ error: "Content not found." }, { status: 404 })
        )
      ),
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
