import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  activateTryoutStartSource,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";

const identity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  trackKey: TRYOUT_START_TRACK,
  setKey: TRYOUT_START_SET,
};
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;

describe("locale-neutral attempt ownership", () => {
  it("resumes, reviews and paginates the same history after every language change", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const owner = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "locale-history",
      });
      await activateTryoutStartSource(ctx, "internal-entry", "raw");
      await ctx.db.patch(user.userId, { plan: "pro" });
      return user;
    });
    const client = t.withIdentity({
      subject: owner.authUserId,
      sessionId: owner.sessionId,
    });
    const first = await client.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...identity, locale: "id", entrySectionKey: TRYOUT_START_SECTION }
    );
    for (const locale of ["en", "de", "id"] as const) {
      const resumed = await client.mutation(
        api.tryouts.mutations.attempts.startAttempt,
        { ...identity, locale }
      );
      expect(resumed.attemptId).toBe(first.attemptId);
      expect(
        await client.query(api.tryouts.queries.attemptPage.getSet, {
          request: { ...identity, kind: "current", locale },
        })
      ).toMatchObject({ kind: "redirect", attemptId: first.attemptId });
    }
    await client.mutation(api.tryouts.mutations.sections.complete, {
      attemptId: first.attemptId,
      sectionKey: TRYOUT_START_SECTION,
    });
    for (const locale of ["en", "de", "id"] as const) {
      const page = await client.query(api.tryouts.queries.attemptPage.getSet, {
        request: {
          kind: "retained",
          attemptId: first.attemptId,
          publicPath: setPath,
          locale,
        },
      });
      expect(page).toMatchObject({
        kind: "retained",
        attemptId: first.attemptId,
        content: {
          questions: [
            expect.objectContaining({
              appLocale: locale,
              artifactHash: makeTryoutStartPlacement("id").questionArtifactHash,
            }),
          ],
          answers: [
            expect.objectContaining({
              appLocale: locale,
              artifactHash: makeTryoutStartPlacement(locale).answerArtifactHash,
            }),
          ],
        },
      });
      expect(
        await client.query(api.tryouts.queries.attemptPage.getSet, {
          request: { ...identity, kind: "current", locale },
        })
      ).toMatchObject({ kind: "current", attemptId: first.attemptId });
    }
    vi.setSystemTime(new Date(TRYOUT_START_NOW + 10_000));
    const second = await client.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...identity, locale: "en" }
    );
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(await t.query((ctx) => ctx.db.get(second.attemptId))).toMatchObject({
      attemptNumber: 2,
      appLocale: "en",
    });
    expect(
      await t.query((ctx) => ctx.db.query("tryoutSetProgress").collect())
    ).toEqual([
      expect.objectContaining({
        latestAttemptId: second.attemptId,
        attemptNumber: 2,
        appLocale: "en",
      }),
    ]);
    for (const locale of ["id", "de", "en"] as const) {
      const firstPage = await client.query(api.tryouts.queries.history.bySet, {
        ...identity,
        locale,
        paginationOpts: { numItems: 1, cursor: null },
      });
      expect(firstPage.page.map((row) => row.attemptId)).toEqual([
        second.attemptId,
      ]);
      const secondPage = await client.query(api.tryouts.queries.history.bySet, {
        ...identity,
        locale,
        paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
      });
      expect(secondPage.page.map((row) => row.attemptId)).toEqual([
        first.attemptId,
      ]);
    }
  });
});
