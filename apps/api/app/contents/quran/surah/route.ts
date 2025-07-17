import { NextResponse } from "next/server";

export function GET(_req: Request) {
  return NextResponse.json({
    message: "Surah API is working",
  });
}
