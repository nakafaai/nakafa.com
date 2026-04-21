import { type NextRequest, NextResponse } from "next/server";

/** Returns one delayed SVG so browser tests can verify image-driven row growth. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const delay = Number(searchParams.get("delay") ?? "0");
  const label = searchParams.get("label") ?? "playwright";

  if (delay > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520">
      <rect width="720" height="520" fill="#f4e8d8" />
      <rect x="24" y="24" width="672" height="472" rx="24" fill="#1f2937" />
      <text x="50%" y="50%" dominant-baseline="middle" fill="#f9fafb" font-family="system-ui" font-size="48" text-anchor="middle">
        ${label}
      </text>
    </svg>
  `;

  return new NextResponse(svg, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/svg+xml",
    },
  });
}
