import { describe, expect, it } from "@effect/vitest";
import {
  hasExactFamilies,
  loadReleaseFamilies,
  mergeManagedFamilies,
} from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

describe("contentRelease/scope/family", () => {
  it("preserves established ownership in canonical contract order", () => {
    const merged = mergeManagedFamilies(
      ["material", "question"],
      ["article", "material", "page"]
    );

    expect(merged).toEqual(["article", "material", "page", "question"]);
    expect(hasExactFamilies(merged, [...merged])).toBe(true);
    expect(hasExactFamilies(["material", "article"], merged)).toBe(false);
  });

  it.live("rejects noncanonical durable ownership", () =>
    Effect.gen(function* () {
      expect(
        yield* loadReleaseFamilies({
          baseFamilies: [],
          releaseId: "release-noncanonical",
          resultFamilies: ["material", "article"],
        }).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );
});
