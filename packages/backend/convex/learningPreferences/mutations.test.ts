import {
  ActiveAppLocaleListSchema,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
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
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";

const NOW = 1_798_752_000_000;
const PREFERENCE_APP_LOCALES = Schema.decodeSync(ActiveAppLocaleListSchema)([
  "en",
  "id",
]);

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

type PreferenceTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Creates one authenticated preference-test user. */
const seedPreferenceUser = Effect.fn("test.learningPreferences.seedUser")(
  function* (t: PreferenceTest) {
    return yield* Effect.promise(() =>
      t.mutation((ctx) =>
        runConvexProgram(
          Effect.promise(() => seedAuthenticatedUser(ctx, { now: NOW }))
        )
      )
    );
  }
);

/** Creates one authenticated user and activates the signed try-out source. */
const seedTryoutPreferenceUser = Effect.fn(
  "test.learningPreferences.seedTryoutUser"
)(function* (t: PreferenceTest) {
  return yield* Effect.promise(() =>
    t.mutation((ctx) =>
      runConvexProgram(
        Effect.gen(function* () {
          const user = yield* Effect.promise(() =>
            seedAuthenticatedUser(ctx, { now: NOW })
          );
          yield* Effect.promise(() =>
            activateTryoutStartSource(ctx, "visible")
          );
          return user;
        })
      )
    )
  );
});

describe("learningPreferences", () => {
  it.effect(
    "lists school curriculum preferences in catalog display order",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        yield* syncPrograms(t);

        const programs = yield* Effect.promise(() =>
          t.query(api.learningPreferences.queries.listCurriculumPrograms, {
            locale: "id",
          })
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
      })
  );

  it.effect(
    "saves and reads the authenticated user's preferred curriculum",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const identity = yield* seedPreferenceUser(t);
        yield* syncPrograms(t);

        const guestPreference = yield* Effect.promise(() =>
          t.query(api.learningPreferences.queries.getCurrent, { locale: "id" })
        );
        expect(guestPreference).toBeNull();

        const authed = t.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });
        const saved = yield* Effect.promise(() =>
          authed.mutation(
            api.learningPreferences.mutations.setPreferredCurriculum,
            {
              locale: "id",
              preferredCurriculumProgramKey: "united-states",
            }
          )
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
        const current = yield* Effect.promise(() =>
          authed.query(api.learningPreferences.queries.getCurrent, {
            locale: "id",
          })
        );
        expect(current).toMatchObject(saved);
      })
  );

  it.effect(
    "saves and reads the authenticated user's preferred try-out country",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const identity = yield* seedTryoutPreferenceUser(t);

        const guestPreference = yield* Effect.promise(() =>
          t.query(api.learningPreferences.queries.getCurrentTryout, {
            locale: "id",
          })
        );
        expect(guestPreference).toBeNull();

        const authed = t.withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        });
        const saved = yield* Effect.promise(() =>
          authed.mutation(
            api.learningPreferences.mutations.setPreferredTryoutCountry,
            {
              locale: "id",
              preferredTryoutCountryKey: "indonesia",
            }
          )
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
        const currentTryout = yield* Effect.promise(() =>
          authed.query(api.learningPreferences.queries.getCurrentTryout, {
            locale: "id",
          })
        );
        expect(currentTryout).toMatchObject(saved);
        const currentCurriculum = yield* Effect.promise(() =>
          authed.query(api.learningPreferences.queries.getCurrent, {
            locale: "id",
          })
        );
        expect(currentCurriculum).toBeNull();
      })
  );

  it.effect("rejects a try-out country missing from the signed catalog", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const identity = yield* seedTryoutPreferenceUser(t);
      const authed = t.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });

      yield* Effect.promise(() =>
        expect(
          authed.mutation(
            api.learningPreferences.mutations.setPreferredTryoutCountry,
            {
              locale: "id",
              preferredTryoutCountryKey: "missing-country",
            }
          )
        ).rejects.toMatchObject({
          data: {
            code: "TRYOUT_COUNTRY_NOT_FOUND",
            message: "Try-out country not found.",
          },
        })
      );
    })
  );

  it.effect("rejects non-curriculum program keys", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const identity = yield* seedPreferenceUser(t);
      yield* syncPrograms(t);

      const authed = t.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });

      yield* Effect.promise(() =>
        expect(
          authed.mutation(
            api.learningPreferences.mutations.setPreferredCurriculum,
            {
              locale: "id",
              preferredCurriculumProgramKey: "snbt",
            }
          )
        ).rejects.toMatchObject({
          data: {
            code: "CURRICULUM_PROGRAM_NOT_FOUND",
            message: "Curriculum program not found.",
          },
        })
      );
    })
  );
});

/** Activates the reviewed program copy as one signed snapshot. */
const syncPrograms = Effect.fn("test.learningPreferences.syncPrograms")(
  function* (t: PreferenceTest) {
    const data = yield* makeProgramSnapshotData(
      PREFERENCE_PROGRAMS,
      PREFERENCE_APP_LOCALES
    );
    yield* Effect.promise(() => activateProgramSnapshot(t, data));
  }
);

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
