import { debugDir } from "@repo/contents/_lib/utils";
import { NextResponse } from "next/server";

export function GET(_req: Request) {
  const data = debugDir();

  return NextResponse.json({
    data,
  });
}
