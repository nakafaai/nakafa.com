import { getSurah } from "@repo/contents/_lib/quran";
import { SurahNotFoundError } from "@repo/contents/_shared/error";
import { createServiceLogger, logError } from "@repo/utilities/logging";
import { Effect, Option } from "effect";
import { NextResponse } from "next/server";

export const revalidate = false;

const logger = createServiceLogger("api-quran");

export function generateStaticParams() {
  // surah 1-114
  return Array.from({ length: 114 }, (_, i) => ({
    surah: (i + 1).toString(),
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surah: string }> }
) {
  const { surah } = await params;

  const surahNumber = Number.parseInt(surah, 10);

  const program = Effect.gen(function* () {
    const surahData = Option.fromNullable(getSurah(surahNumber));

    if (Option.isNone(surahData)) {
      return yield* Effect.fail(new SurahNotFoundError({ surahNumber }));
    }

    return surahData.value;
  });

  const response = await Effect.runPromise(
    Effect.match(program, {
      onFailure: (error: unknown) => {
        logError(
          logger,
          error instanceof Error ? error : new Error(String(error)),
          {
            surah: surahNumber,
            message: "Failed to fetch surah.",
          }
        );

        const statusCode = error instanceof SurahNotFoundError ? 404 : 500;

        return NextResponse.json(
          { error: "Failed to fetch surah." },
          { status: statusCode }
        );
      },
      onSuccess: (data) => NextResponse.json(data),
    })
  );

  return response;
}
