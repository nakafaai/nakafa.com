import { getVerseBySurah } from "@repo/contents/_lib/quran";
import { NextResponse } from "next/server";

// can not support static params for 114 surah and 6236 verses = 710.904 params
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; verse: string }> }
) {
  const { id, verse } = await params;

  const verseData = getVerseBySurah({
    surah: Number.parseInt(id, 10),
    verse: Number.parseInt(verse, 10),
  });

  return NextResponse.json(verseData);
}
