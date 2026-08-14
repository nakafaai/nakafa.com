import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program-snapshot";
import { activateTryoutStartSource } from "@repo/backend/test/tryout-source";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const NOW = 1_798_752_000_000;

const PREFERENCE_PROGRAMS = [
  makePreferenceProgram(1, "merdeka", "ID", "merdeka", "Kurikulum Merdeka"),
  makePreferenceProgram(
    2,
    "cambridge-international",
    "GB",
    "cambridge-international",
    "Cambridge International"
  ),
  makePreferenceProgram(3, "singapore-moe", "SG", "singapura", "Singapore MOE"),
  makePreferenceProgram(
    4,
    "united-states",
    "US",
    "amerika-serikat",
    "United States Standards-Aligned Pathway"
  ),
  makePreferenceProgram(5, "snbt", "ID", "snbt", "SNBT", "admission-exam"),
];

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

  it("saves and reads the authenticated user's preferred try-out country", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });
      await activateTryoutStartSource(ctx, "visible");
      return user;
    });

    await expect(
      t.query(api.learningPreferences.queries.getCurrentTryout, {
        locale: "id",
      })
    ).resolves.toBeNull();

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const saved = await authed.mutation(
      api.learningPreferences.mutations.setPreferredTryoutCountry,
      {
        locale: "id",
        preferredTryoutCountryKey: "indonesia",
      }
    );

    expect(saved).toMatchObject({
      country: {
        countryCode: "ID",
        key: "indonesia",
        publicPath: "try-out/indonesia",
        title: "Indonesia",
      },
      preferredTryoutCountryKey: "indonesia",
    });
    await expect(
      authed.query(api.learningPreferences.queries.getCurrentTryout, {
        locale: "id",
      })
    ).resolves.toMatchObject(saved);
    await expect(
      authed.query(api.learningPreferences.queries.getCurrent, { locale: "id" })
    ).resolves.toBeNull();
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
          locale: "id",
          preferredCurriculumProgramKey: "snbt",
        }
      )
    ).rejects.toThrow("CURRICULUM_PROGRAM_NOT_FOUND");
  });
});

/** Activates the reviewed program copy as one signed snapshot. */
async function syncPrograms(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  const data = await Effect.runPromise(
    makeProgramSnapshotData(PREFERENCE_PROGRAMS)
  );
  await activateProgramSnapshot(t, data);
}

/** Builds one explicit signed current program used by preference tests. */
function makePreferenceProgram(
  index: number,
  key: string,
  countryCode: string,
  publicSlug: string,
  title: string,
  kind: LearningProgram["kind"] = "school-curriculum"
) {
  const base = makeTechnicalProgram(index, kind);

  return LearningProgramSchema.make({
    ...base,
    key: LearningProgramKeySchema.make(key),
    provider: {
      ...base.provider,
      homeCountry: countryCode,
    },
    recommendedCountry: countryCode,
    translations: [
      { appLocale: ActiveAppLocaleSchema.make("en"), publicSlug, title },
      { appLocale: ActiveAppLocaleSchema.make("id"), publicSlug, title },
    ],
  });
}
