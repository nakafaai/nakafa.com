import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { defaultLocale } from "@repo/utilities/locales";
import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import { readQuranApiDocument } from "@/lib/content/quran";

export const dynamic = "force-dynamic";
export const revalidate = false;

/**
 * Returns one Quran surah from the active signed Aksara publication.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surah: string }> }
) {
  const { surah } = await params;
  const surahNumber = parseQuranSurahNumber(surah);

  if (!surahNumber) {
    return NextResponse.json(
      { error: "Failed to fetch surah." },
      { status: 404 }
    );
  }

  return Effect.runPromise(
    readQuranApiDocument({ appLocale: defaultLocale, surahNumber }).pipe(
      Effect.map((document) =>
        NextResponse.json({
          ...document.surah,
          locale: document.appLocale,
          verses: document.verses,
        })
      ),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* logError(toError(error), {
            service: "api-quran",
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
