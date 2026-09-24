import { describe, expect, it } from "@effect/vitest";
import { decodePublicationPosition } from "@repo/backend/content/article/cursor";
import { Effect } from "effect";

describe("article publication cursor", () => {
  it.effect(
    "rejects a cursor from an unsupported protocol before reading a publication",
    () =>
      Effect.gen(function* () {
        expect(
          yield* Effect.flip(decodePublicationPosition("foreign-cursor"))
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Article publication cursor has an unsupported format.",
        });
      })
  );
});
