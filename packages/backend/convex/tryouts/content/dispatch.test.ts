// @vitest-environment node

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { dispatchProgram } from "@repo/backend/convex/tryouts/content/dispatch";
import {
  TEST_KEY_RESOLVER,
  testSignedArtifact,
} from "@repo/backend/test/content-proof";
import {
  requireFixtureValue,
  seedTryoutArtifactState,
} from "@repo/backend/test/tryout-content";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const QUESTION_KEY =
  "question-bank/tryout/indonesia/snbt/mathematical-reasoning/set-1/question-1/question";
const ANSWER_KEY =
  "question-bank/tryout/indonesia/snbt/mathematical-reasoning/set-1/question-1/answer";
const REQUEST = JSON.stringify({
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  sectionKey: "penalaran-matematika",
  setKey: "set-1",
  trackKey: "2027",
});

/** Executes the deep Node dispatcher with the isolated technical key. */
function runDispatch(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  userId: Id<"users">,
  source = REQUEST,
  byteLength = new TextEncoder().encode(source).byteLength
) {
  return t.action((ctx) =>
    runConvexProgram(
      dispatchProgram(ctx, source, byteLength, userId).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
    )
  );
}

/** Replaces schema-only fixtures with fully authenticated technical artifacts. */
function seedSignedContent(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  terminal = false
) {
  const questionArtifact = testSignedArtifact("snbt-math", {
    contentKey: QUESTION_KEY,
    locale: "id",
  });
  const answerArtifact = testSignedArtifact("snbt-math", {
    contentKey: ANSWER_KEY,
    locale: "id",
  });

  return t.mutation(async (ctx) => {
    const fixture = await seedTryoutArtifactState(ctx, {
      attemptStatus: terminal ? "completed" : "in-progress",
      sectionStatus: terminal ? "completed" : "in-progress",
      suffix: terminal ? "signed-terminal" : "signed-active",
    });
    for (const stored of await ctx.db.query("contentArtifacts").take(3)) {
      await ctx.db.delete("contentArtifacts", stored._id);
    }
    await ctx.db.insert("contentArtifacts", {
      artifactHash: questionArtifact.artifactHash,
      artifactJson: JSON.stringify(questionArtifact),
      createdAt: 1,
      retainUntil: Number.MAX_SAFE_INTEGER,
    });
    await ctx.db.insert("contentArtifacts", {
      artifactHash: answerArtifact.artifactHash,
      artifactJson: JSON.stringify(answerArtifact),
      createdAt: 1,
      retainUntil: Number.MAX_SAFE_INTEGER,
    });
    await ctx.db.patch(
      "tryoutAttemptPlacements",
      requireFixtureValue(fixture.placementIds),
      {
        answerArtifactHash: answerArtifact.artifactHash,
        answerContentKey: answerArtifact.payload.contentKey,
        questionArtifactHash: questionArtifact.artifactHash,
        questionContentKey: questionArtifact.payload.contentKey,
      }
    );
    return fixture;
  });
}

describe("tryouts/content/dispatch", () => {
  it("authenticates active questions without returning answer artifacts", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await seedSignedContent(t);

    const result = await runDispatch(t, fixture.identity.userId);

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      artifacts: [
        {
          placementId: fixture.placementIds[0],
          questionArtifact: { payload: { contentKey: QUESTION_KEY } },
        },
      ],
      kind: "found",
    });
    expect(JSON.parse(result.body).artifacts[0]).not.toHaveProperty(
      "answerArtifact"
    );
  });

  it("returns authenticated answers only for terminal review", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await seedSignedContent(t, true);

    await expect(
      runDispatch(t, fixture.identity.userId)
    ).resolves.toMatchObject({ status: 200 });
    expect(
      JSON.parse((await runDispatch(t, fixture.identity.userId)).body)
    ).toMatchObject({
      artifacts: [
        {
          answerArtifact: { payload: { contentKey: ANSWER_KEY } },
          questionArtifact: { payload: { contentKey: QUESTION_KEY } },
        },
      ],
      kind: "found",
    });
  });

  it("returns unavailable for another user and rejects malformed bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutArtifactState(ctx, {
        suffix: "dispatch-owner",
      });
      const other = await seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "dispatch-other",
      });
      return { fixture, other };
    });

    await expect(runDispatch(t, seeded.other.userId)).resolves.toEqual({
      body: '{"kind":"unavailable"}',
      status: 200,
    });
    await expect(
      runDispatch(t, seeded.fixture.identity.userId, "{")
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      runDispatch(t, seeded.fixture.identity.userId, REQUEST, 1)
    ).resolves.toMatchObject({ status: 400 });
  });

  it("fails closed when a stored signed artifact is tampered", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await seedSignedContent(t);
    await t.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentArtifacts").first();
      if (!stored) {
        throw new Error("Expected one signed content artifact.");
      }
      const artifact = JSON.parse(stored.artifactJson);
      artifact.payload.rawMdx = "tampered";
      await ctx.db.patch("contentArtifacts", stored._id, {
        artifactJson: JSON.stringify(artifact),
      });
    });

    await expect(runDispatch(t, fixture.identity.userId)).resolves.toEqual({
      body: '{"code":"TRYOUT_CONTENT_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });
});
