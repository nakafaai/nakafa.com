import { getSurah } from "@repo/contents/_lib/quran";
import { NextResponse } from "next/server";

export function generateStaticParams() {
  // surah 1-114
  return Array.from({ length: 114 }, (_, i) => ({
    id: (i + 1).toString(),
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const surah = getSurah(Number.parseInt(id, 10));

  return NextResponse.json(surah);
}
