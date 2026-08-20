import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { NextResponse } from "next/server";
import {
  getApiContentReferenceByContentId,
  parseApiContentId,
} from "@/lib/content/runtime";

export const dynamic = "force-dynamic";
export const revalidate = false;

/** Resolves one stable graph content ID to its current signed reference. */
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
    getApiContentReferenceByContentId({ contentId: parsedContentId }).pipe(
      Effect.map((reference): Response => {
        if (!reference) {
          return NextResponse.json(
            { error: "Content reference not found." },
            { status: 404 }
          );
        }

        return NextResponse.json(reference);
      }),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* logError(error, {
            service: "api-content-reference",
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
