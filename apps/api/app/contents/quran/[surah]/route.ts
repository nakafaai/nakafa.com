import { getSurah } from "@repo/contents/_lib/quran";
import {
  createServiceLogger,
  createTimer,
  logError,
} from "@repo/utilities/logging";
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
  const requestContext = {
    surah: surahNumber,
  };

  logger.info(requestContext, "Fetching surah");

  const endTimer = createTimer(logger, "get-surah", requestContext);

  try {
    const surahData = getSurah(surahNumber);

    const duration = endTimer();

    logger.info(
      {
        ...requestContext,
        duration,
        hasSurahData: !!surahData,
      },
      "Surah fetched successfully"
    );

    return NextResponse.json(surahData);
  } catch (error) {
    endTimer();

    logError(
      logger,
      error instanceof Error ? error : new Error(String(error)),
      {
        ...requestContext,
        message: "Failed to fetch surah",
      }
    );

    return NextResponse.json(
      { error: "Failed to fetch surah" },
      { status: 500 }
    );
  }
}
