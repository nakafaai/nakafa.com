import { getVersesByJuz } from "@repo/contents/_lib/quran";
import { NextResponse } from "next/server";

export function generateStaticParams() {
  // juz 1-30
  return Array.from({ length: 30 }, (_, i) => ({
    id: (i + 1).toString(),
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const verses = getVersesByJuz(Number.parseInt(id, 10));

  return NextResponse.json(verses);
}
