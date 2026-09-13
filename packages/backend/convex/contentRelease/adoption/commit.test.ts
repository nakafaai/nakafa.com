import { describe, expect, it } from "@effect/vitest";
import { commitAdoption } from "@repo/backend/convex/contentRelease/adoption/commit";
import {
  hashAdoptionState,
  readAdoptionState,
} from "@repo/backend/convex/contentRelease/adoption/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertAdoptionHistory } from "@repo/backend/test/content/adoption";
import { Effect } from "effect";

async function setup() {
  const t = createConvexTestWithBetterAuth();
  const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
  return { t, fixture };
}

describe("contentRelease/adoption/commit", () => {
  it("atomically rebinds history and scale pointers while preserving every learner value", async () => {
    const { t, fixture } = await setup();
    const before = fixture.state.history;
    const originalState = await t.query((ctx) =>
      ctx.db.query("contentState").unique()
    );
    const result = await t.mutation((ctx) =>
      runConvexProgram(commitAdoption(ctx, fixture.commit))
    );
    expect(result).toEqual({
      attempts: 1,
      placements: 1,
      scores: 1,
      scales: 1,
      scaleItems: 1,
    });
    const rows = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(
        "tryoutAttempts",
        fixture.seed.request.attemptId
      ),
      placement: await ctx.db.get(
        "tryoutAttemptPlacements",
        fixture.seed.placementId
      ),
      response: await ctx.db.get("tryoutResponses", fixture.responseId),
      score: await ctx.db.get("tryoutScores", fixture.scoreId),
      section: await ctx.db.get(
        "tryoutSectionAttempts",
        fixture.seed.sectionId
      ),
      scale: await ctx.db.get("irtScaleVersions", fixture.scaleId),
      item: await ctx.db.get("irtScaleItems", fixture.itemId),
      state: await ctx.db.query("contentState").unique(),
    }));
    const entry = before.entries[0];
    const scaleEntry = before.scaleEntries[0];
    const pair = fixture.state.placements[0];
    expect(entry).toBeDefined();
    expect(scaleEntry).toBeDefined();
    expect(pair).toBeDefined();
    if (!(entry && scaleEntry && pair)) {
      throw new Error("Expected exact technical history.");
    }
    expect(rows.attempt).toEqual({
      ...entry.attempt,
      tryoutBundleId: fixture.newBundleId,
      tryoutBundleHash: fixture.state.newBundle.bundleHash,
      tryoutSnapshotId: fixture.state.newBundle.snapshotId,
    });
    expect(rows.placement).toEqual({
      ...entry.placements[0],
      placementRowHash: pair.next.rowHash,
      questionArtifactHash: pair.next.questionArtifactHash,
      answerArtifactHash: pair.next.answerArtifactHash,
    });
    expect(rows.response).toEqual(entry.responses[0]);
    expect(rows.section).toEqual(entry.sections[0]);
    expect(rows.score).toEqual({
      ...entry.scores[0],
      tryoutSnapshotId: fixture.state.newBundle.snapshotId,
    });
    expect(rows.scale).toEqual({
      ...scaleEntry.scale,
      tryoutSnapshotId: fixture.state.newBundle.snapshotId,
    });
    expect(rows.item).toEqual({
      ...scaleEntry.items[0],
      placementRowHash: pair.next.rowHash,
    });
    expect(rows.state).toEqual(originalState);
    expect(rows.attempt?.snapshotReleaseId).toBe(
      entry.attempt.snapshotReleaseId
    );
  });

  it("rejects a changed answer after authentication without rebinding any history", async () => {
    const { t, fixture } = await setup();
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutResponses", fixture.responseId, {
        selection: { kind: "single-choice", optionKey: "b" },
      })
    );
    await expect(
      t.mutation((ctx) => runConvexProgram(commitAdoption(ctx, fixture.commit)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    const attempt = await t.query((ctx) =>
      ctx.db.get("tryoutAttempts", fixture.seed.request.attemptId)
    );
    expect(attempt?.tryoutBundleHash).toBe(fixture.state.oldBundle.bundleHash);
  });

  it("rejects a newly created retained attempt outside the reviewed digest", async () => {
    const { t, fixture } = await setup();
    const original = fixture.state.history.entries[0]?.attempt;
    if (!original) {
      throw new Error("Expected a retained attempt.");
    }
    const { _id, _creationTime, ...fields } = original;
    await t.mutation((ctx) =>
      ctx.db.insert("tryoutAttempts", { ...fields, attemptNumber: 2 })
    );
    await expect(
      t.mutation((ctx) => runConvexProgram(commitAdoption(ctx, fixture.commit)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it.effect(
    "rolls back earlier pointer writes when a frozen IRT row loses membership",
    () =>
      Effect.gen(function* () {
        const { t, fixture } = yield* Effect.promise(() => setup());
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("irtScaleItems", fixture.itemId, {
              placementRowHash: "changed",
            })
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(readAdoptionState(ctx, fixture.identity))
          )
        );
        const stateHash = yield* hashAdoptionState(state);
        yield* Effect.promise(() =>
          expect(
            t.mutation((ctx) =>
              runConvexProgram(
                commitAdoption(ctx, {
                  ...fixture.commit,
                  stateHash,
                  expectedHistoryHash: state.historyHash,
                })
              )
            )
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        const attempt = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.get("tryoutAttempts", fixture.seed.request.attemptId)
          )
        );
        const placement = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.get("tryoutAttemptPlacements", fixture.seed.placementId)
          )
        );
        expect(attempt).toEqual(state.history.entries[0]?.attempt);
        expect(placement).toEqual(state.history.entries[0]?.placements[0]);
      })
  );

  it("rejects candidate activation or abort between authentication and commit", async () => {
    for (const patch of [
      { status: "completed" as const },
      { abortingAt: 100 },
    ]) {
      const { t, fixture } = await setup();
      await t.mutation((ctx) =>
        ctx.db.patch("contentReleases", fixture.candidateId, patch)
      );
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(commitAdoption(ctx, fixture.commit))
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    }
  });

  it("rejects changed authenticated artifact bytes and incomplete evidence", async () => {
    const { t, fixture } = await setup();
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          commitAdoption(ctx, {
            ...fixture.commit,
            artifacts: [],
          })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    const artifactHash = fixture.commit.artifacts[0]?.artifactHash;
    if (!artifactHash) {
      throw new Error("Expected artifact evidence.");
    }
    await t.mutation(async (ctx) => {
      const artifact = await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (q) => q.eq("artifactHash", artifactHash))
        .unique();
      if (artifact) {
        await ctx.db.patch("contentArtifacts", artifact._id, {
          artifactJson: "{}",
        });
      }
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(commitAdoption(ctx, fixture.commit)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });
  it.effect(
    "rejects changed frozen membership even when its latest state digest is supplied",
    () =>
      Effect.gen(function* () {
        const { t, fixture } = yield* Effect.promise(() => setup());
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("tryoutAttemptPlacements", fixture.seed.placementId, {
              placementRowHash: "changed",
            })
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(readAdoptionState(ctx, fixture.identity))
          )
        );
        const stateHash = yield* hashAdoptionState(state);
        yield* Effect.promise(() =>
          expect(
            t.mutation((ctx) =>
              runConvexProgram(
                commitAdoption(ctx, {
                  ...fixture.commit,
                  stateHash,
                  expectedHistoryHash: state.historyHash,
                })
              )
            )
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              ctx.db.get("tryoutAttempts", fixture.seed.request.attemptId)
            )
          )
        ).toEqual(state.history.entries[0]?.attempt);
      })
  );
});
