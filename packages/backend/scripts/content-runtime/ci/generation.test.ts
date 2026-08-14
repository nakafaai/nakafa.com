import {
  buildRuntimeGenerations,
  decodeJsonRows,
  verifyRuntimeGenerations,
} from "@repo/backend/scripts/content-runtime/ci/generation";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const contentState = [
  {
    _creationTime: 1,
    _id: "state-1",
    activeManifestHash: "a".repeat(64),
    activeReleaseId: "current-release",
    activeSequence: 9,
    key: "primary",
  },
];

describe("content runtime generations", () => {
  it("is stable across Convex system fields", async () => {
    const baseline = await Effect.runPromise(
      buildRuntimeGenerations(contentState)
    );
    const systemFieldsChanged = await Effect.runPromise(
      buildRuntimeGenerations([
        { ...contentState[0], _creationTime: 999, _id: "different" },
      ])
    );

    expect(systemFieldsChanged).toEqual(baseline);
  });

  it("changes when the current signed pointer changes", async () => {
    const baseline = await Effect.runPromise(
      buildRuntimeGenerations(contentState)
    );
    const changed = await Effect.runPromise(
      buildRuntimeGenerations([
        { ...contentState[0], activeReleaseId: "next-release" },
      ])
    );

    expect(changed.contentStateHash).not.toBe(baseline.contentStateHash);
    const verificationFailure = await Effect.runPromise(
      verifyRuntimeGenerations(
        {
          cacheVersion: "v2",
          ...baseline,
          runtimeSchemaFingerprint: "1".repeat(64),
        },
        changed
      ).pipe(Effect.flip)
    );
    expect(verificationFailure).toMatchObject({
      _tag: "ContentRuntimeCiError",
    });
  });

  it("rejects malformed or non-singleton pointer inputs", async () => {
    await expect(Effect.runPromise(decodeJsonRows(""))).resolves.toEqual([]);
    await expect(
      Effect.runPromise(buildRuntimeGenerations([]).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });
    await expect(
      Effect.runPromise(
        buildRuntimeGenerations([...contentState, ...contentState]).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });
    await expect(
      Effect.runPromise(decodeJsonRows("not-json").pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });
  });
});
