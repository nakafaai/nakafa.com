import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { readTryoutContent } from "@repo/backend/convex/tryouts/content/impl";
import { tryoutContentErrorCode } from "@repo/backend/convex/tryouts/content/spec";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  requireFixtureValue,
  seedTryoutArtifactState,
  type TryoutContentFixture,
} from "@repo/backend/test/tryout-content";
import { describe, expect, it } from "vitest";

type ContentTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Reads one fixture through only its stable route and authenticated owner. */
function resolveContent(
  t: ContentTest,
  fixture: TryoutContentFixture,
  userId = fixture.identity.userId
) {
  return t.query((ctx) =>
    runConvexProgram(
      readTryoutContent(ctx, {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        sectionKey: fixture.sectionKey,
        setKey: "set-1",
        trackKey: "2027",
        userId,
      })
    )
  );
}

describe("tryouts/content/impl", () => {
  it("returns only questions while active and adds answers after completion", async () => {
    const active = createConvexTestWithBetterAuth();
    const activeFixture = await active.mutation((ctx) =>
      seedTryoutArtifactState(ctx, { suffix: "active-content" })
    );

    await expect(resolveContent(active, activeFixture)).resolves.toMatchObject({
      artifacts: [
        {
          placementId: activeFixture.placementIds[0],
          questionArtifactJson: expect.any(String),
        },
      ],
    });
    expect(
      (await resolveContent(active, activeFixture))?.artifacts[0]
    ).not.toHaveProperty("answerArtifactJson");

    const completed = createConvexTestWithBetterAuth();
    const completedFixture = await completed.mutation((ctx) =>
      seedTryoutArtifactState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "completed-content",
      })
    );
    await expect(
      resolveContent(completed, completedFixture)
    ).resolves.toMatchObject({
      artifacts: [
        {
          answerArtifactJson: expect.any(String),
          placementId: completedFixture.placementIds[0],
          questionArtifactJson: expect.any(String),
        },
      ],
    });
  });

  it("returns unavailable for absent ownership, section, or content access", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutArtifactState(ctx, {
        suffix: "unavailable",
      });
      const other = await seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "other-owner",
      });
      return { fixture, other };
    });

    await expect(
      resolveContent(t, seeded.fixture, seeded.other.userId)
    ).resolves.toBeNull();
    await t.mutation((ctx) =>
      ctx.db.delete("tryoutSectionAttempts", seeded.fixture.sectionAttemptId)
    );
    await expect(resolveContent(t, seeded.fixture)).resolves.toBeNull();
  });

  it("fails closed for incomplete migration and inconsistent stable identity", async () => {
    const missing = createConvexTestWithBetterAuth();
    const missingFixture = await missing.mutation((ctx) =>
      seedTryoutArtifactState(ctx, {
        includeReferences: false,
        suffix: "missing-references",
      })
    );
    await expect(resolveContent(missing, missingFixture)).rejects.toMatchObject(
      {
        data: { code: tryoutContentErrorCode.migration },
      }
    );

    const mismatch = createConvexTestWithBetterAuth();
    const mismatchFixture = await mismatch.mutation(async (ctx) => {
      const fixture = await seedTryoutArtifactState(ctx, {
        suffix: "identity-mismatch",
      });
      await ctx.db.patch("tryoutAttempts", fixture.attemptId, {
        locale: "en",
      });
      return fixture;
    });
    await expect(
      resolveContent(mismatch, mismatchFixture)
    ).rejects.toMatchObject({
      data: { code: tryoutContentErrorCode.integrity },
    });
  });

  it("rejects cross-kind, missing, malformed, and mismatched artifacts", async () => {
    for (const failure of [
      "cross-kind",
      "missing",
      "malformed",
      "mismatch",
    ] as const) {
      const t = createConvexTestWithBetterAuth();
      const fixture = await t.mutation(async (ctx) => {
        const seeded = await seedTryoutArtifactState(ctx, {
          suffix: `artifact-${failure}`,
        });
        if (failure === "cross-kind") {
          await ctx.db.patch(
            "tryoutAttemptPlacements",
            requireFixtureValue(seeded.placementIds),
            {
              questionArtifactHash: requireFixtureValue(seeded.answerHashes),
              questionContentKey: requireFixtureValue(seeded.answerKeys),
            }
          );
          return seeded;
        }
        const artifactHash = requireFixtureValue(seeded.questionHashes);
        const stored = await ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (query) =>
            query.eq("artifactHash", artifactHash)
          )
          .unique();
        if (!stored) {
          throw new Error("Expected frozen question artifact fixture.");
        }
        if (failure === "missing") {
          await ctx.db.delete("contentArtifacts", stored._id);
        } else {
          await ctx.db.patch("contentArtifacts", stored._id, {
            artifactJson:
              failure === "malformed"
                ? "{}"
                : testArtifactJson({
                    artifactHash,
                    contentKey: "question-bank/mismatched/question",
                    rendererDomain: "snbt-math",
                  }),
          });
        }
        return seeded;
      });

      await expect(resolveContent(t, fixture)).rejects.toMatchObject({
        data: {
          code:
            failure === "missing"
              ? tryoutContentErrorCode.missing
              : tryoutContentErrorCode.integrity,
        },
      });
    }
  });

  it("rejects placement-count drift and oversized section responses", async () => {
    const drift = createConvexTestWithBetterAuth();
    const driftFixture = await drift.mutation(async (ctx) => {
      const fixture = await seedTryoutArtifactState(ctx, {
        suffix: "placement-drift",
      });
      await ctx.db.delete(
        "tryoutAttemptPlacements",
        requireFixtureValue(fixture.placementIds)
      );
      return fixture;
    });
    await expect(resolveContent(drift, driftFixture)).rejects.toMatchObject({
      data: { code: tryoutContentErrorCode.migration },
    });

    const oversized = createConvexTestWithBetterAuth();
    const oversizedFixture = await oversized.mutation((ctx) =>
      seedTryoutArtifactState(ctx, {
        compiledBytes: 530_000,
        placementCount: 9,
        suffix: "oversized-content",
      })
    );
    await expect(
      resolveContent(oversized, oversizedFixture)
    ).rejects.toMatchObject({
      data: { code: tryoutContentErrorCode.limit },
    });
  });
});
