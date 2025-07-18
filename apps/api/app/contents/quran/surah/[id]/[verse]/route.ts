import { NextResponse } from "next/server";

export function generateStaticParams() {
  const ids: string[] = [];
  const verses: string[] = [];

  // 114 surah
  for (let i = 1; i <= 114; i++) {
    ids.push(i.toString());
  }

  // 6236 verses
  for (let i = 1; i <= 6236; i++) {
    verses.push(i.toString());
  }

  return ids.flatMap((id) => verses.map((verse) => ({ id, verse })));
}

// can not support static params for 114 surah and 6236 verses = 710.904 params
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; verse: string }> }
) {
  const { id, verse } = await params;

  return NextResponse.json({
    id,
    verse,
  });
}
