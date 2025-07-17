import { debugDir } from "@repo/contents/_lib/utils";
import { NextResponse } from "next/server";

export async function GET(_req: Request) {
  const data = await debugDir();

  return NextResponse.json({
    data,
  });
}
