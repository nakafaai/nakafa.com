import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import { getQuranApiSurahPage } from "@/lib/content/runtime";

export const dynamic = "force-dynamic";
export const revalidate = false;

/**
 * Returns one Quran surah from the durable Convex Quran runtime model.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surah: string }> }
) {
  const { surah } = await params;
  const surahNumber = parseSurahNumber(surah);

  if (!surahNumber) {
    return NextResponse.json(
      { error: "Failed to fetch surah." },
      { status: 404 }
    );
  }

  return Effect.runPromise(
    getQuranApiSurahPage({ surah: surahNumber }).pipe(
      Effect.map((page) => {
        if (!page) {
          return NextResponse.json(
            { error: "Failed to fetch surah." },
            { status: 404 }
          );
        }

        return NextResponse.json(page.surahData);
      }),
      Effect.catchAll((error) =>
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

/** Parses a route segment into a positive Quran surah number. */
function parseSurahNumber(value: string) {
  const surahNumber = Number.parseInt(value, 10);

  if (Number.isNaN(surahNumber) || surahNumber.toString() !== value) {
    return null;
  }

  if (surahNumber < 1) {
    return null;
  }

  return surahNumber;
}

/** Converts unknown Effect failures into real Error values for structured logging. */
function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
