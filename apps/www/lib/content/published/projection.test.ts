// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { decodePublishedMaterial } from "@/lib/content/published/projection";
import { previewProjection, previewPublicRoute } from "@/test/content-preview";

const identity = {
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};

describe("published material projection", () => {
  it("adapts the exact signed projection to the current route shell", async () => {
    await expect(
      Effect.runPromise(decodePublishedMaterial(previewProjection, identity))
    ).resolves.toEqual({
      projection: previewProjection,
      route: previewPublicRoute,
    });
  });

  it("keeps invalid projection data in the typed error channel", async () => {
    const failures = [
      { ...previewProjection, parentPath: "subjects/other" },
      { ...previewProjection, contentKey: "test:invalid-route-source" },
    ];

    for (const input of failures) {
      await expect(
        Effect.runPromise(
          decodePublishedMaterial(input, identity).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    }
  });
});
