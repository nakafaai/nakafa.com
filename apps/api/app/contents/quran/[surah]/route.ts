import { getSurah } from "@repo/contents/_lib/quran";
import { NextResponse } from "next/server";

export function generateStaticParams() {
  // surah 1-114
  return Array.from({ length: 114 }, (_, i) => ({
    surah: (i + 1).toString(),
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surah: string }> },
) {
  const { surah } = await params;

  const surahData = getSurah(Number.parseInt(surah, 10));

  return NextResponse.json(surahData);
}
