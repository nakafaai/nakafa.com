import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodeSourceRevision } from "@/lib/content/published/origin";

const identity = { locale: "id", publicPath: "try-out" } as const;

describe("content/published/origin", () => {
  it("treats omitted and null revisions as absent", async () => {
    await expect(
      Effect.runPromise(decodeSourceRevision(undefined, identity))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(decodeSourceRevision(null, identity))
    ).resolves.toBeNull();
  });

  it("decodes exact Git provenance", async () => {
    const revision = "a".repeat(40);

    await expect(
      Effect.runPromise(decodeSourceRevision(revision, identity))
    ).resolves.toBe(revision);
  });

  it("rejects malformed Git provenance", async () => {
    await expect(
      Effect.runPromise(
        decodeSourceRevision("not-a-commit", identity).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
