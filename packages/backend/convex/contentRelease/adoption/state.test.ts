import { describe, expect, it } from "@effect/vitest";
import { readAdoptionState } from "@repo/backend/convex/contentRelease/adoption/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertAdoptionHistory } from "@repo/backend/test/content/adoption";

describe("contentRelease/adoption/state", () => {
  it("rejects unreviewed candidate, bundle and source identities", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
    for (const patch of [
      { candidateManifestHash: "other" },
      { oldBundleHash: "missing" },
      { newBundleHash: fixture.state.oldBundle.bundleHash },
    ]) {
      await expect(
        t.query((ctx) =>
          runConvexProgram(
            readAdoptionState(ctx, { ...fixture.identity, ...patch })
          )
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
    await t.mutation((ctx) =>
      ctx.db.patch("contentReleases", fixture.candidateId, {
        tryoutRuntimeBundleHash: "other",
      })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(readAdoptionState(ctx, fixture.identity))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a changed original attempt binding before collecting replacements", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutAttempts", fixture.seed.request.attemptId, {
        tryoutBundleHash: "changed",
      })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(readAdoptionState(ctx, fixture.identity))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects missing replacement membership while preserving the old snapshot", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
    const pair = fixture.state.placements[0];
    if (!pair) {
      throw new Error("Expected technical placement.");
    }
    await t.mutation((ctx) => ctx.db.delete("tryoutPlacements", pair.next._id));
    await expect(
      t.query((ctx) =>
        runConvexProgram(readAdoptionState(ctx, fixture.identity))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    expect(
      await t.query((ctx) => ctx.db.get("tryoutPlacements", pair.prior._id))
    ).toEqual(pair.prior);
  });
  it("rejects combined historical membership beyond the reviewed 160-identity transaction", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
    const entry = fixture.state.history.entries[0];
    const frozen = entry?.placements[0];
    if (!(entry && frozen)) {
      throw new Error("Expected retained history.");
    }
    await t.mutation(async (ctx) => {
      const { _id, _creationTime, ...fields } = frozen;
      for (let index = 2; index <= 160; index += 1) {
        await ctx.db.insert("tryoutAttemptPlacements", {
          ...fields,
          placementIdentity: `reviewed-${index}`,
          questionOrder: index,
        });
      }
      await ctx.db.patch("tryoutAttempts", entry.attempt._id, {
        totalQuestions: 160,
      });
      await ctx.db.patch("irtScaleItems", fixture.itemId, {
        placementIdentity: "unreviewed-extra",
      });
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(readAdoptionState(ctx, fixture.identity))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });
  });
});
