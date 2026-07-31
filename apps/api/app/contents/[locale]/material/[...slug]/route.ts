import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
  getMaterialApiContentPage,
  invalidApiLocaleMessage,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

export const dynamic = "force-dynamic";
export const revalidate = false;

/** Returns material content lists for `/contents/:locale/material/*`. */
export async function GET(
  request: Request,
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

  const searchParams = new URL(request.url).searchParams;
  const pageParams = parseApiPageParams(searchParams);

  if (!pageParams) {
    return NextResponse.json(
      { error: "Invalid pagination. Limit must be between 1 and 100." },
      { status: 400 }
    );
  }

  const prefix = `material/${slug.join("/")}`;
  return runMaterialApiRead(
    getMaterialApiContentPage({
      ...pageParams,
      locale: validLocale,
      prefix,
    }),
    { locale, slug }
  );
}

/** Converts one content-runtime read into the shared material API response shape. */
function runMaterialApiRead(
  apiRead: ReturnType<typeof getMaterialApiContentPage>,
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

  return Effect.runPromise(
    apiRead.pipe(
      Effect.map((data): Response => NextResponse.json(data)),
      Effect.catchAll(onError)
    )
  );
}
