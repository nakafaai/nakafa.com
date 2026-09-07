import { vWorkflowId } from "@convex-dev/workflow";
import { assert, describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { runProgram } from "@repo/backend/convex/contentRelease/compact";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  beginHistoryRetirement,
  loadRetiredRelease,
} from "@repo/backend/convex/contentRelease/retire/history";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  seedRetirementAttempt,
  seedRetirementHistory,
} from "@repo/backend/test/content/retire";
import { makeFunctionReference } from "convex/server";
import { parse } from "convex-helpers/validators";
import { Effect } from "effect";

describe("contentRelease/retire/history", () => {
  it("compacts only the reviewed predecessor range and resumes safely", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementHistory);
    const begin = () =>
      t.mutation(
        makeFunctionReference<"mutation">("contentRelease/retire:history"),
        {
          plan,
        }
      );
    await expect(begin()).resolves.toEqual({ complete: false, floor: 4 });
    await expect(begin()).resolves.toEqual({ complete: false, floor: 4 });
    await expect(
      t.action((ctx) => runConvexProgram(runProgram(ctx)))
    ).resolves.toMatchObject({ complete: true, floor: 4 });
    await expect(begin()).resolves.toEqual({ complete: true, floor: 4 });
    expect(
      await t.query(async (ctx) =>
        (await ctx.db.query("contentReleases").collect()).map(
          ({ sequence }) => sequence
        )
      )
    ).toEqual([4, 5]);
  });

  it("reports a typed failure for malformed or changed exact identities", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementHistory);
    const first = plan.releases[0];
    assert.ok(first);
    const failure = await t.mutation((ctx) =>
      runConvexProgram(
        loadRetiredRelease(ctx, { ...first, manifestHash: "changed" }).pipe(
          Effect.match({
            onFailure: (error) => ({ code: error.code, tag: error._tag }),
            onSuccess: () => null,
          })
        )
      )
    );
    expect(failure).toEqual({
      code: "CONTENT_RELEASE_INTEGRITY",
      tag: "ReleaseError",
    });
    for (const releases of [
      [],
      [first, first],
      [{ ...first, sequence: 0 }],
      [{ ...first, sequence: 1.5 }],
      Array.from({ length: 33 }, (_, index) => ({
        ...first,
        sequence: index + 1,
      })),
    ]) {
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(beginHistoryRetirement(ctx, { ...plan, releases }))
        )
      ).rejects.toThrow("bounded contiguous");
    }
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          beginHistoryRetirement(ctx, {
            ...plan,
            active: { ...plan.active, manifestHash: "changed" },
          })
        )
      )
    ).rejects.toThrow("slots changed");
  });

  it("preserves modern and protected releases even if a plan names their hashes", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementHistory);
    const modern = {
      ...plan.active,
      sequence: 4,
      releaseId: "release-compact-4",
    };
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          beginHistoryRetirement(ctx, {
            ...plan,
            releases: [...plan.releases, modern],
          })
        )
      )
    ).rejects.toThrow("protected release");
    await t.mutation(async (ctx) => {
      const first = await ctx.db
        .query("contentReleases")
        .withIndex("by_sequence", (q) => q.eq("sequence", 1))
        .unique();
      if (!first) {
        throw new Error("Missing retirement fixture.");
      }
      const parsed = await runConvexProgram(
        decodeReleaseJson(first.releaseJson)
      );
      await ctx.db.patch("contentReleases", first._id, {
        releaseJson: JSON.stringify({
          ...parsed,
          manifest: {
            ...parsed.manifest,
            scope: { families: ["material"], snapshots: [] },
          },
        }),
      });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(beginHistoryRetirement(ctx, plan)))
    ).rejects.toThrow("reviewed retirement identity");
  });

  it("rejects stale singleton slots and a concurrent compaction owner", async () => {
    const patches: Partial<Doc<"contentState">>[] = [
      { activeReleaseId: "changed" },
      { activeSequence: 6 },
      { candidateReleaseId: "pending" },
      { recoveryReleaseId: "retained" },
      { compactedFloor: undefined },
      { compactPhase: "heads", compactFloor: 3, compactFrom: 1 },
      { compactPhase: "heads", compactFloor: 4, compactFrom: 0 },
    ];
    for (const patch of patches) {
      const t = createConvexTestWithBetterAuth();
      const plan = await t.mutation(seedRetirementHistory);
      await t.mutation(async (ctx) => {
        const state = await ctx.db.query("contentState").unique();
        assert.ok(state);
        await ctx.db.patch("contentState", state._id, patch);
      });
      await expect(
        t.mutation((ctx) => runConvexProgram(beginHistoryRetirement(ctx, plan)))
      ).rejects.toThrow("CONTENT_RELEASE_CONFLICT");
    }
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementHistory);
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state);
      await ctx.db.delete("contentState", state._id);
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(beginHistoryRetirement(ctx, plan)))
    ).rejects.toThrow("slots changed");
  });

  it("rejects duplicate sequences, ongoing proof, and a permanent runtime pin", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementHistory);
    const first = plan.releases[0];
    assert.ok(first);
    const duplicateId = await t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("contentReleases")
        .withIndex("by_sequence", (q) => q.eq("sequence", 1))
        .unique();
      assert.ok(row);
      const { _creationTime, _id, ...values } = row;
      return await ctx.db.insert("contentReleases", {
        ...values,
        releaseId: "duplicate-sequence",
      });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(beginHistoryRetirement(ctx, plan)))
    ).rejects.toThrow("duplicate sequences");
    await t.mutation((ctx) => ctx.db.delete("contentReleases", duplicateId));
    for (const patch of [
      { status: "verified" as const },
      {
        status: "aborted" as const,
        proofWorkflowId: parse(vWorkflowId, "test-retirement-workflow"),
      },
    ]) {
      await t.mutation(async (ctx) => {
        const row = await ctx.db
          .query("contentReleases")
          .withIndex("by_sequence", (q) => q.eq("sequence", 1))
          .unique();
        assert.ok(row);
        await ctx.db.patch("contentReleases", row._id, patch);
      });
      await expect(
        t.mutation((ctx) => runConvexProgram(loadRetiredRelease(ctx, first)))
      ).rejects.toThrow("reviewed retirement identity");
    }
    const runtimeTest = createConvexTestWithBetterAuth();
    await runtimeTest.mutation(seedRetirementAttempt);
    await expect(
      runtimeTest.mutation((ctx) =>
        runConvexProgram(beginHistoryRetirement(ctx, plan))
      )
    ).rejects.toThrow("permanent try-out runtime");
  });
});
