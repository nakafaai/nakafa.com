// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeMaterialJson,
  decodeMaterialProjection,
  isMaterialCounterpart,
  isMaterialSibling,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { previewIdProjection, previewProjection } from "@/test/content-preview";

const identity = {
  locale: previewProjection.locale,
  publicPath: previewProjection.publicPath,
};

describe("published material decoding", () => {
  it("decodes exact object and canonical JSON projections", async () => {
    await expect(
      Effect.runPromise(
        Effect.all([
          decodeMaterialProjection(previewProjection, identity),
          decodeMaterialJson(
            canonicalizeMaterialProjection(previewProjection),
            identity
          ),
        ])
      )
    ).resolves.toEqual([previewProjection, previewProjection]);
  });

  it.each([
    ["invalid JSON", "{"],
    ["invalid projection", "{}"],
  ])("preserves %s in the typed error channel", async (_label, source) => {
    await expect(
      Effect.runPromise(decodeMaterialJson(source, identity).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
  });

  it("rejects a projection selected through another public identity", async () => {
    await expect(
      Effect.runPromise(
        decodeMaterialProjection(previewProjection, {
          ...identity,
          publicPath: `${identity.publicPath}-other`,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });

    await expect(
      Effect.runPromise(
        decodeMaterialProjection({}, identity).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("compares stable counterparts and localized sibling groups", () => {
    expect(isMaterialCounterpart(previewProjection, previewIdProjection)).toBe(
      true
    );
    expect(isMaterialSibling(previewProjection, previewProjection)).toBe(true);
    expect(isMaterialSibling(previewProjection, previewIdProjection)).toBe(
      false
    );
  });

  it("accepts only identical projections from one active release", async () => {
    const activeReleaseId = ReleaseIdSchema.make("release-active");
    const catalog = { activeReleaseId, projection: previewProjection };

    await expect(
      Effect.runPromise(verifyMaterialPublication(catalog, catalog))
    ).resolves.toBeUndefined();

    await expect(
      Effect.runPromise(
        verifyMaterialPublication(catalog, {
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          projection: previewProjection,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: activeReleaseId,
    });

    await expect(
      Effect.runPromise(
        verifyMaterialPublication(catalog, {
          activeReleaseId,
          projection: {
            ...previewProjection,
            metadata: {
              ...previewProjection.metadata,
              title: "Different title",
            },
          },
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
  });
});
