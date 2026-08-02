import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { makeTryoutMigrationArgs } from "@repo/backend/test/tryout-migration";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SECTION as SECTION,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};
const setPath = `try-out/${COUNTRY}/${EXAM}/${TRACK}/${SET}`;

describe("tryouts/start/source", () => {
  it("rejects entry-section starts for visible sections", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-visible",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        ...startArgs,
        entrySectionKey: SECTION,
      })
    ).rejects.toThrow("TRYOUT_ENTRY_SECTION_NOT_FOUND");
    await expect(
      t.query((ctx) => ctx.db.query("tryoutFreeAttemptClaims").collect())
    ).resolves.toEqual([]);
  });

  it("starts from signed rows after filesystem ownership is removed", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-signed-only",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      await ctx.db.delete(fixture.tryoutSectionId);
      await ctx.db.delete(fixture.tryoutSetId);
      return { snapshotId: fixture.snapshotId, user };
    });
    const authed = t.withIdentity({
      sessionId: seeded.user.sessionId,
      subject: seeded.user.authUserId,
    });

    const result = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );
    const current = await authed.query(
      api.tryouts.queries.attempt.getCurrent,
      startArgs
    );
    const currentByPath = await authed.query(
      api.tryouts.queries.attempt.getCurrentByPublicPath,
      { locale: "id", publicPath: setPath }
    );
    await authed.mutation(api.tryouts.mutations.sections.start, {
      attemptId: result.attemptId,
      sectionKey: SECTION,
    });
    const runtime = await authed.query(api.tryouts.queries.runtime.getSection, {
      ...startArgs,
      sectionKey: SECTION,
    });
    const history = await authed.query(api.tryouts.queries.history.list, {
      locale: "id",
      paginationOpts: { cursor: null, numItems: 25 },
      publicPath: setPath,
    });
    const writes = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(result.attemptId),
      claims: await ctx.db.query("tryoutFreeAttemptClaims").collect(),
      placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
    }));
    await authed.mutation(api.tryouts.mutations.sections.complete, {
      attemptId: result.attemptId,
      sectionKey: SECTION,
    });
    const migrationArgs = makeTryoutMigrationArgs(seeded.snapshotId);
    const migrationResults = await Promise.all([
      t.mutation(
        internal.tryouts.migrations.attempt.migrateAttempts,
        migrationArgs
      ),
      t.mutation(
        internal.tryouts.migrations.progress.migrateProgress,
        migrationArgs
      ),
      t.mutation(
        internal.tryouts.migrations.progress.migrateSections,
        migrationArgs
      ),
      t.mutation(
        internal.tryouts.migrations.placement.migratePlacements,
        migrationArgs
      ),
      t.mutation(
        internal.tryouts.migrations.score.migrateScores,
        migrationArgs
      ),
    ]);

    expect(writes.attempt).toMatchObject({
      setIdentity: expect.any(String),
      tryoutSnapshotId: expect.any(String),
    });
    expect(writes.attempt).not.toHaveProperty("tryoutSetId");
    expect(writes.attempt?.sectionSnapshots[0]).not.toHaveProperty(
      "tryoutSectionId"
    );
    expect(writes.claims).toHaveLength(1);
    expect(writes.placements).toHaveLength(1);
    expect(writes.placements[0]).not.toHaveProperty("tryoutSectionId");
    expect(current).toMatchObject({
      attemptId: result.attemptId,
      status: "in-progress",
    });
    expect(currentByPath?.attemptId).toBe(result.attemptId);
    expect(runtime).toMatchObject({
      attemptId: result.attemptId,
      questions: [expect.objectContaining({ sourcePath: expect.any(String) })],
      section: { sectionKey: SECTION, status: "in-progress" },
    });
    expect(history.page).toEqual([
      expect.objectContaining({
        attemptId: result.attemptId,
        status: "in-progress",
      }),
    ]);
    expect(migrationResults.every(({ changed }) => changed === 0)).toBe(true);
  });
});
