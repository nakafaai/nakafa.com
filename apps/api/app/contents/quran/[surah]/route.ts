import { getAllSurah, getSurah } from "@repo/contents/_lib/quran";
import { SurahNotFoundError } from "@repo/contents/_shared/error";
import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";

export const revalidate = false;

export function generateStaticParams() {
  return getAllSurah().map((surah) => ({
    surah: surah.number.toString(),
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surah: string }> }
) {
  const { surah } = await params;
  const surahNumber = Number.parseInt(surah, 10);

  return Effect.runPromise(
    getSurah(surahNumber).pipe(
      Effect.matchEffect({
        onFailure: (error: unknown) =>
          Effect.gen(function* () {
            const err =
              error instanceof Error ? error : new Error(String(error));

            yield* logError(err, {
              service: "api-quran",
              surah: surahNumber,
              message: "Failed to fetch surah.",
            });

            const statusCode = error instanceof SurahNotFoundError ? 404 : 500;

            return NextResponse.json(
              { error: "Failed to fetch surah." },
              { status: statusCode }
            );
          }),
        onSuccess: (data) => Effect.succeed(NextResponse.json(data)),
      })
    )
  );
}
