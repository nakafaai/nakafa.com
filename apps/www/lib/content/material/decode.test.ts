// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import {
  decodeMaterialJson,
  decodeMaterialProjection,
  isMaterialCounterpart,
  isMaterialSibling,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { previewIdProjection, previewProjection } from "@/test/content-preview";

const identity = {
  appLocale: previewProjection.appLocale,
  publicPath: previewProjection.publicPath,
};

describe("published material decoding", () => {
  it.effect("decodes exact object and canonical JSON projections", () =>
    Effect.gen(function* () {
      expect(
        yield* Effect.all([
          decodeMaterialProjection(previewProjection, identity),
          decodeMaterialJson(
            canonicalizeMaterialProjection(previewProjection),
            identity
          ),
        ])
      ).toEqual([previewProjection, previewProjection]);
    })
  );

  it.effect.each([
    { label: "invalid JSON", source: "{" },
    { label: "invalid projection", source: "{}" },
  ] as const)("preserves $label in the typed error channel", ({ source }) =>
    Effect.gen(function* () {
      expect(
        yield* decodeMaterialJson(source, identity).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    })
  );

  it.effect(
    "rejects a projection selected through another public identity",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decodeMaterialProjection(previewProjection, {
            ...identity,
            publicPath: `${identity.publicPath}-other`,
          }).pipe(Effect.flip)
        ).toMatchObject({ _tag: "PublishedProjectionError" });

        expect(
          yield* decodeMaterialProjection({}, identity).pipe(Effect.flip)
        ).toMatchObject({ _tag: "PublishedProjectionError" });
      })
  );

  it("compares stable counterparts and localized sibling groups", () => {
    expect(isMaterialCounterpart(previewProjection, previewIdProjection)).toBe(
      true
    );
    expect(isMaterialSibling(previewProjection, previewProjection)).toBe(true);
    expect(isMaterialSibling(previewProjection, previewIdProjection)).toBe(
      false
    );
  });

  it.effect("accepts only identical projections from one active release", () =>
    Effect.gen(function* () {
      const activeReleaseId = ReleaseIdSchema.make("release-active");
      const catalog = { activeReleaseId, projection: previewProjection };

      yield* verifyMaterialPublication(catalog, catalog);

      expect(
        yield* verifyMaterialPublication(catalog, {
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          projection: previewProjection,
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: "release-next",
        expectedReleaseId: activeReleaseId,
      });

      expect(
        yield* verifyMaterialPublication(catalog, {
          activeReleaseId,
          projection: {
            ...previewProjection,
            metadata: {
              ...previewProjection.metadata,
              title: "Different title",
            },
          },
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        ...identity,
      });
    })
  );
});
