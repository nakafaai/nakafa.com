import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
  getApiContentRouteByContentId,
  parseApiContentId,
} from "@/lib/content/runtime";

export const dynamic = "force-dynamic";
export const revalidate = false;

/** Resolves one stable graph content ID to its public route projection. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
): Promise<Response> {
  const { contentId } = await params;
  const parsedContentId = parseApiContentId(contentId);

  if (!parsedContentId) {
    return NextResponse.json(
      { error: "Invalid graph content ID." },
      { status: 400 }
    );
  }

  return Effect.runPromise(
    getApiContentRouteByContentId({ contentId: parsedContentId }).pipe(
      Effect.map((route): Response => {
        if (!route) {
          return NextResponse.json(
            { error: "Content route not found." },
            { status: 404 }
          );
        }

        return NextResponse.json(route);
      }),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* logError(error, {
            service: "api-content-graph",
            contentId: parsedContentId,
            message: "Failed to resolve graph content ID.",
          });

          return NextResponse.json(
            { error: "Failed to resolve graph content ID." },
            { status: 500 }
          );
        })
      )
    )
  );
}
