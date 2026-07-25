import {
  CONTENT_DOCUMENT_LIMIT,
  ensureDocumentSize,
  HEAD_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/document", () => {
  it("accepts bounded documents and rejects complete oversized rows", async () => {
    await expect(
      Effect.runPromise(
        ensureDocumentSize("Small document", {
          optional: undefined,
          value: "bounded",
        })
      )
    ).resolves.toBeUndefined();

    const failure = await Effect.runPromise(
      ensureDocumentSize("Large document", {
        value: "x".repeat(CONTENT_DOCUMENT_LIMIT),
      }).pipe(Effect.flip)
    );
    expect(failure).toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
      message: "Large document exceeds the content document ceiling.",
    });

    const headFailure = await Effect.runPromise(
      ensureDocumentSize(
        "Large head",
        { sourcePath: "x".repeat(HEAD_DOCUMENT_LIMIT) },
        HEAD_DOCUMENT_LIMIT
      ).pipe(Effect.flip)
    );
    expect(headFailure).toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
      message: "Large head exceeds the content document ceiling.",
    });
  });
});
