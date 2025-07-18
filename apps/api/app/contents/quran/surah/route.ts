import { getAllSurah } from "@repo/contents/_lib/quran";
import { NextResponse } from "next/server";

export function GET() {
  const surahs = getAllSurah();
  return NextResponse.json(surahs);
}
