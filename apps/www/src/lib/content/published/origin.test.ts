import { describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import { decodeSourceRevision } from "@/lib/content/published/origin";

const identity = {
  appLocale: AppLocaleSchema.make("id"),
  publicPath: "try-out",
} as const;

describe("content/published/origin", () => {
  it.effect("treats omitted and null revisions as absent", () =>
    Effect.gen(function* () {
      expect(yield* decodeSourceRevision(undefined, identity)).toBeNull();
      expect(yield* decodeSourceRevision(null, identity)).toBeNull();
    })
  );

  it.effect("decodes exact Git provenance", () =>
    Effect.gen(function* () {
      const revision = "a".repeat(40);

      expect(yield* decodeSourceRevision(revision, identity)).toBe(revision);
    })
  );

  it.effect("rejects malformed Git provenance", () =>
    decodeSourceRevision("not-a-commit", identity).pipe(
      Effect.flip,
      Effect.map((error) =>
        expect(error).toMatchObject({ _tag: "PublishedProjectionError" })
      )
    )
  );
});
