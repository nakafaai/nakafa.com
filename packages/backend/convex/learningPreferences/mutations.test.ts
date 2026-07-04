import { api, internal } from "@repo/backend/convex/_generated/api";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = 1_798_752_000_000;

describe("learningPreferences", () => {
  it("lists school curriculum preferences in catalog display order", async () => {
    const t = createConvexTestWithBetterAuth();

    await syncPrograms(t);

    const programs = await t.query(
      api.learningPreferences.queries.listCurriculumPrograms,
      { locale: "id" }
    );

    expect(programs.map((program) => program.key)).toEqual([
      "merdeka",
      "cambridge-international",
      "singapore-moe",
      "united-states",
    ]);
    expect(programs.at(-1)).toMatchObject({
      countryCode: "US",
      publicSlug: "amerika-serikat",
      title: "United States Standards-Aligned Pathway",
    });
  });

  it("saves and reads the authenticated user's preferred curriculum", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await syncPrograms(t);

    await expect(
      t.query(api.learningPreferences.queries.getCurrent, { locale: "id" })
    ).resolves.toBeNull();

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const saved = await authed.mutation(
      api.learningPreferences.mutations.setPreferredCurriculum,
      {
        locale: "id",
        preferredCurriculumProgramKey: "united-states",
      }
    );

    expect(saved).toMatchObject({
      preferredCurriculumProgramKey: "united-states",
      program: {
        countryCode: "US",
        key: "united-states",
        publicSlug: "amerika-serikat",
        title: "United States Standards-Aligned Pathway",
      },
    });
    await expect(
      authed.query(api.learningPreferences.queries.getCurrent, {
        locale: "id",
      })
    ).resolves.toMatchObject(saved);
  });

  it("reads an existing school curriculum profile before a preference row exists", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await syncPrograms(t);
    await t.mutation(async (ctx) => {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "merdeka"))
        .unique();

      expect(program).not.toBeNull();

      if (!program) {
        return;
      }

      await ctx.db.insert("learningProfiles", {
        interests: ["school-curriculum"],
        programId: program._id,
        updatedAt: NOW,
        userId: identity.userId,
      });
    });

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.learningPreferences.queries.getCurrent, { locale: "id" })
    ).resolves.toMatchObject({
      preferredCurriculumProgramKey: "merdeka",
      program: {
        countryCode: "ID",
        key: "merdeka",
        publicSlug: "merdeka",
        title: "Kurikulum Merdeka",
      },
    });
  });

  it("rejects non-curriculum program keys", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );

    await syncPrograms(t);

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(
        api.learningPreferences.mutations.setPreferredCurriculum,
        {
          preferredCurriculumProgramKey: "snbt-2026",
        }
      )
    ).rejects.toThrow("CURRICULUM_PROGRAM_NOT_SUPPORTED");
  });
});

/** Syncs the source-owned learning program catalog into the test database. */
async function syncPrograms(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
    programs: getLearningProgramCatalogInputs(),
    syncedAt: NOW,
  });
}
