import {
  buildRuntimeGenerations,
  formatGenerationEnvironment,
  verifyRuntimeGenerations,
} from "@repo/backend/scripts/content-runtime/ci/generation";
import { decodeJsonRows } from "@repo/backend/scripts/content-runtime/ci/json";
import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content-runtime/tables";
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
    expect(baseline.contentStateHash).toBe(
      "81b0dcbf693af64c1be78d3c657485632e80f68e84ddc657e970c646137fc680"
    );
    expect(formatGenerationEnvironment(baseline)).toBe(
      `AGENT_DOCS_CONTENT_STATE_HASH=${baseline.contentStateHash}`
    );
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
          cacheVersion: CONTENT_RUNTIME_CACHE_VERSION,
          contentStateHash: baseline.contentStateHash,
          runtimeSchemaFingerprint: "3".repeat(64),
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
