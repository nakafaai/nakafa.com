import {
  buildRuntimeGenerations,
  formatGenerationEnvironment,
  verifyRuntimeGenerations,
} from "@repo/backend/scripts/content-runtime/ci/generation";
import { decodeJsonRows } from "@repo/backend/scripts/content-runtime/ci/json";
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
    const cutoverRowsIgnored = await Effect.runPromise(
      buildRuntimeGenerations(
        contentState,
        [{ invalid: true }],
        [{ invalid: true }]
      )
    );

    expect(systemFieldsChanged).toEqual(baseline);
    expect(cutoverRowsIgnored).toEqual(baseline);
    expect(baseline.contentStateHash).toBe(
      "81b0dcbf693af64c1be78d3c657485632e80f68e84ddc657e970c646137fc680"
    );
    expect(baseline).toMatchObject({
      mode: "published",
      runtimeGenerationHash: baseline.contentStateHash,
    });
    expect(formatGenerationEnvironment(baseline)).toBe(
      [
        "AGENT_DOCS_CONTENT_RUNTIME_MODE=published",
        `AGENT_DOCS_RUNTIME_GENERATION_HASH=${baseline.runtimeGenerationHash}`,
        `AGENT_DOCS_CONTENT_STATE_HASH=${baseline.contentStateHash}`,
      ].join("\n")
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
          runtimeGenerationHash: baseline.runtimeGenerationHash,
          runtimeMode: baseline.mode,
        },
        changed
      ).pipe(Effect.flip)
    );
    expect(verificationFailure).toMatchObject({
      _tag: "ContentRuntimeCiError",
    });
    await expect(
      Effect.runPromise(
        verifyRuntimeGenerations(
          {
            runtimeGenerationHash: baseline.runtimeGenerationHash,
            runtimeMode: "proved-maintenance",
          },
          baseline
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });
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
