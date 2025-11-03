import { getSurah } from "@repo/contents/_lib/quran";
import { createServiceLogger, logError } from "@repo/utilities/logging";
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

  try {
    const surahData = getSurah(surahNumber);

    return NextResponse.json(surahData);
  } catch (error) {
    logError(
      logger,
      error instanceof Error ? error : new Error(String(error)),
      {
        surah: surahNumber,
        message: "Failed to fetch surah",
      }
    );

    return NextResponse.json(
      { error: "Failed to fetch surah" },
      { status: 500 }
    );
  }
}
