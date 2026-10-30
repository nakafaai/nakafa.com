import { describe, expect, it } from "@effect/vitest";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import { Effect } from "effect";

describe("contentRelease/digest", () => {
  it.effect("hashes exact text as a contract SHA-256 identity", () =>
    Effect.gen(function* () {
      expect(yield* hashText("Nakafa")).toBe(
        "sha256:f62f8f484c23826f9adf97fd1bef18fad23b3bedada4d908cbcf4c2cf924a63e"
      );
    })
  );
});
