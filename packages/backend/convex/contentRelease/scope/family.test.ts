import {
  hasExactFamilies,
  loadReleaseFamilies,
  mergeManagedFamilies,
} from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/scope/family", () => {
  it("preserves established ownership in canonical contract order", () => {
    const merged = mergeManagedFamilies(
      ["material", "question"],
      ["article", "material"]
    );

    expect(merged).toEqual(["article", "material", "question"]);
    expect(hasExactFamilies(merged, [...merged])).toBe(true);
    expect(hasExactFamilies(["material", "article"], merged)).toBe(false);
  });

  it("rejects noncanonical durable ownership", async () => {
    await expect(
      Effect.runPromise(
        loadReleaseFamilies({
          baseFamilies: [],
          releaseId: "release-noncanonical",
          resultFamilies: ["material", "article"],
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });
});
