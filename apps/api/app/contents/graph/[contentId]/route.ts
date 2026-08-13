import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = false;

/** Retires the mutable graph schema without fabricating its old timestamps. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
): Promise<Response> {
  const { contentId } = await params;
  const successor = `/contents/reference/${encodeURIComponent(contentId)}`;

  return NextResponse.json(
    {
      error: "The legacy content graph contract has been retired.",
      successor,
    },
    {
      headers: {
        Link: `<${successor}>; rel="successor-version"`,
      },
      status: 410,
    }
  );
}
