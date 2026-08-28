import { describe, expect, it } from "@effect/vitest";
import {
  CONTENT_DOCUMENT_LIMIT,
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { Effect } from "effect";

describe("contentRelease/document", () => {
  it.live("accepts bounded documents and rejects complete oversized rows", () =>
    Effect.gen(function* () {
      expect(
        yield* ensureDocumentSize("Small document", {
          optional: undefined,
          value: "bounded",
        })
      ).toBeUndefined();

      const failure = yield* ensureDocumentSize("Large document", {
        value: "x".repeat(CONTENT_DOCUMENT_LIMIT),
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({
        code: "CONTENT_RELEASE_SIZE",
        message: "Large document exceeds the content document ceiling.",
      });

      const headFailure = yield* ensureDocumentSize(
        "Large head",
        { sourcePath: "x".repeat(READ_MODEL_DOCUMENT_LIMIT) },
        READ_MODEL_DOCUMENT_LIMIT
      ).pipe(Effect.flip);
      expect(headFailure).toMatchObject({
        code: "CONTENT_RELEASE_SIZE",
        message: "Large head exceeds the content document ceiling.",
      });
    })
  );
});
