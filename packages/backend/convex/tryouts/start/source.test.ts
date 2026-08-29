import { describe, expect, it, vi } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { loadTryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { testSignedRelease } from "@repo/backend/test/content/proof";
import {
  activateRenamedTryoutStartSource,
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";
import { Effect, Schema } from "effect";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};
const REUSED_RELEASE_ID = ReleaseIdSchema.make("release-tryout-reused");
describe("tryouts/start/source", () => {
  it.effect(
    "starts from signed rows after filesystem ownership is removed",
    () =>
      Effect.gen(function* () {
        vi.setSystemTime(new Date(NOW));

        const t = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible", "raw"))
        );
        const source = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(loadTryoutStartSource(ctx, startArgs))
          )
        );

        expect(source).toMatchObject({
          snapshot: {
            setIdentity: expect.any(String),
            snapshotId: expect.any(String),
          },
        });
      })
  );

  it.effect("pins the later release that selects a reused runtime", () =>
    Effect.gen(function* () {
      vi.setSystemTime(new Date(NOW));

      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const user = await seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "tryout-reused-runtime",
          });
          await seedTryoutStartSet(ctx, {
            userId: user.userId,
            visibility: "visible",
          });
          const [release, state] = await Promise.all([
            ctx.db.query("contentReleases").unique(),
            ctx.db.query("contentState").unique(),
          ]);
          if (!(release && state)) {
            throw new Error("Expected one active try-out release fixture.");
          }
          const source = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
            JSON.parse(release.releaseJson)
          );
          const reused = testSignedRelease({
            ...source.manifest,
            releaseId: REUSED_RELEASE_ID,
          });
          await ctx.db.patch("contentReleases", release._id, {
            releaseId: REUSED_RELEASE_ID,
            releaseJson: JSON.stringify(reused),
          });
          await ctx.db.patch("contentState", state._id, {
            activeManifestHash: reused.manifestHash,
            activeReleaseId: REUSED_RELEASE_ID,
          });
          return { sourceReleaseId: source.manifest.releaseId, user };
        })
      );
      const source = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(loadTryoutStartSource(ctx, startArgs))
        )
      );
      expect(source).toMatchObject({
        bundle: { sourceReleaseId: seeded.sourceReleaseId },
        releaseId: REUSED_RELEASE_ID,
      });

      const authed = t.withIdentity({
        sessionId: seeded.user.sessionId,
        subject: seeded.user.authUserId,
      });
      const started = yield* Effect.promise(() =>
        authed.mutation(api.tryouts.mutations.attempts.startAttempt, startArgs)
      );
      const attempt = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.get("tryoutAttempts", started.attemptId))
      );
      expect(attempt).toMatchObject({
        snapshotReleaseId: REUSED_RELEASE_ID,
      });
    })
  );

  it.effect("resumes one logical set after its public path changes", () =>
    Effect.gen(function* () {
      vi.setSystemTime(new Date(NOW));

      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const user = await seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "tryout-renamed-set",
          });
          await seedTryoutStartSet(ctx, {
            userId: user.userId,
            visibility: "visible",
          });
          return user;
        })
      );
      const authed = t.withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      });
      const started = yield* Effect.promise(() =>
        authed.mutation(api.tryouts.mutations.attempts.startAttempt, startArgs)
      );

      yield* Effect.promise(() => t.mutation(activateRenamedTryoutStartSource));

      yield* Effect.promise(() =>
        expect(
          authed.query(api.tryouts.queries.runtime.getSetAttemptState, {
            attemptId: started.attemptId,
          })
        ).resolves.toMatchObject({
          attempt: { attemptId: started.attemptId },
        })
      );
    })
  );
});
