// @vitest-environment node

import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeMaterialJson,
  decodeMaterialProjection,
  isMaterialCounterpart,
  isMaterialSibling,
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
});
