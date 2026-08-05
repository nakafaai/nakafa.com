import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import { readQuranApiPage } from "@/lib/content/quran";
import { invalidApiLocaleMessage, parseApiLocale } from "@/lib/content/runtime";

export const dynamic = "force-dynamic";
export const revalidate = false;

/**
 * Returns one Quran surah from the active signed Aksara publication.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; surah: string }> }
) {
  const { locale, surah } = await params;
  const validLocale = parseApiLocale(locale);

  if (!validLocale) {
    return NextResponse.json(
      { error: invalidApiLocaleMessage },
      { status: 400 }
    );
  }

  const surahNumber = parseQuranSurahNumber(surah);

  if (!surahNumber) {
    return NextResponse.json(
      { error: "Failed to fetch surah." },
      { status: 404 }
    );
  }

  return Effect.runPromise(
    readQuranApiPage({ locale: validLocale, surahNumber }).pipe(
      Effect.map((page) =>
        NextResponse.json({ ...page.surah, verses: page.verses })
      ),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* logError(toError(error), {
            service: "api-quran",
            locale: validLocale,
            surah: surahNumber,
            message: "Failed to fetch surah.",
          });

          return NextResponse.json(
            { error: "Failed to fetch surah." },
            { status: 500 }
          );
        })
      )
    )
  );
}

/** Converts unknown Effect failures into real Error values for structured logging. */
function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
