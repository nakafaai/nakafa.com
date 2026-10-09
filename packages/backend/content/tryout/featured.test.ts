import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import { convexModules } from "@repo/backend/confect/test.setup";
import { LANDING_FEATURED_TRYOUT } from "@repo/backend/content/tryout/featured";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import {
  activateLandingSource,
  makeLandingHierarchy,
  makeLandingPlacement,
} from "@repo/backend/test/tryout/landing";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import { TRYOUT_START_CONTENT_HASH } from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Option, Schema } from "effect";

const LANDING_SET_PATH = "try-out/indonesia/snbt/2027/set-1";
const DISTRACTOR_CONTENT_ROOT =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1";
const DISTRACTOR_SOURCE_ROOT =
  "packages/corpus/question-bank/tryout/indonesia/snbt/general-reasoning/set-1";
const DISTRACTOR_QUESTION_ROOT = `${DISTRACTOR_CONTENT_ROOT}/question-1`;
const DISTRACTOR_QUESTION_SOURCE_ROOT = `${DISTRACTOR_SOURCE_ROOT}/question-1`;

/** Adds an earlier signed section without changing the landing target. */
function makeLeadingSectionHierarchy(locale: ActiveAppLocaleCode) {
  const hierarchy = makeLandingHierarchy(locale, "visible");
  const target = Arr.findFirst(
    hierarchy,
    (row) =>
      row.kind === "section" &&
      row.sectionKey === LANDING_FEATURED_TRYOUT.sectionKey
  );
  if (!(Option.isSome(target) && target.value.kind === "section")) {
    throw new Error("Expected the stable landing section fixture.");
  }

  return Schema.decodeSync(Schema.Array(TryoutCatalogRowSchema))([
    ...Arr.map(hierarchy, (row) => {
      if (row.kind === "track" || row.kind === "set") {
        return {
          ...row,
          questionCount: 2,
          sectionCount: 2,
          visibleSectionCount: 2,
        };
      }
      if (row.kind === "section") {
        return { ...row, order: 2 };
      }
      return row;
    }),
    {
      ...target.value,
      order: 1,
      publicPath: `${LANDING_SET_PATH}/general-reasoning`,
      questionSourcePath: DISTRACTOR_SOURCE_ROOT,
      sectionKey: "general-reasoning",
      title: "General Reasoning",
    },
  ]);
}

/** Creates the earlier signed placement used to prove order independence. */
function makeLeadingPlacement(locale: ActiveAppLocaleCode) {
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...makeLandingPlacement(locale),
    answerContentKey: `${DISTRACTOR_QUESTION_ROOT}/answer`,
    questionContentKey: `${DISTRACTOR_QUESTION_ROOT}/question`,
    questionSourcePath: DISTRACTOR_QUESTION_SOURCE_ROOT,
    rendererDomain: "snbt-plain",
    sectionKey: "general-reasoning",
  });
}

/** Makes the first authored placement exercise the full response contract. */
function makeMultipleChoicePlacement(locale: ActiveAppLocaleCode) {
  const placement = makeLandingPlacement(locale);
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...placement,
    response: {
      kind: "multiple-choice",
      options: [
        { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
        { isCorrect: true, label: "B", optionKey: "option-2", order: 2 },
        { isCorrect: false, label: "C", optionKey: "option-3", order: 3 },
      ],
    },
  });
}

/** Makes the first authored placement exercise category assignments. */
function makeCategoryPlacement(locale: ActiveAppLocaleCode) {
  const placement = makeLandingPlacement(locale);
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...placement,
    response: {
      categories: [
        { categoryKey: "category-1", label: "Benar", order: 1 },
        { categoryKey: "category-2", label: "Salah", order: 2 },
      ],
      kind: "category",
      statements: [
        {
          correctCategoryKey: "category-1",
          label: "Pernyataan",
          order: 1,
          statementKey: "statement-1",
        },
      ],
    },
  });
}

describe("tryouts/catalog/featured", () => {
  it.effect.each(["country", "exam", "track", "set", "section"] as const)(
    "rejects a publication missing its featured %s",
    (kind) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshotId = await activateTryoutSnapshot(ctx, {
              catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
                Arr.filter(
                  makeLandingHierarchy(locale, "visible"),
                  (row) => row.kind !== kind
                )
              ),
              placements: Arr.map(
                ACTIVE_APP_LOCALE_CODES,
                makeLandingPlacement
              ),
            });
            await insertTestTryoutRuntimeBundle(ctx, snapshotId);
          })
        );
        const failure = yield* Effect.tryPromise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        ).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `The active try-out publication has no featured ${kind}.`,
          },
        });
      })
  );

  it.effect.each(["set", "bundle"] as const)(
    "rejects a replaced featured %s without selecting another example",
    (missing) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshotId = await activateTryoutSnapshot(ctx, {
              catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
                Arr.map(makeLandingHierarchy(locale, "visible"), (row) =>
                  missing === "set" && "setKey" in row
                    ? { ...row, setKey: "set-2" }
                    : row
                )
              ),
              placements: Arr.map(
                ACTIVE_APP_LOCALE_CODES,
                makeLandingPlacement
              ),
            });
            if (missing !== "bundle") {
              await insertTestTryoutRuntimeBundle(ctx, snapshotId);
            }
          })
        );
        const failure = yield* Effect.tryPromise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        ).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `The active try-out publication has no featured ${missing === "set" ? "set" : "question"}.`,
          },
        });
      })
  );

  it.effect(
    "returns the stable signed question for the public landing demo",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const source = makeLandingPlacement("id");
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateLandingSource(ctx, "visible"))
        );

        const featured = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        );

        expect(featured).toEqual({
          question: {
            artifactHash: source.questionArtifactHash,
            bundleHash: expect.any(String),
            contentHash: TRYOUT_START_CONTENT_HASH,
            contentKey: source.questionContentKey,
            delivery: "authenticated",
            appLocale: "id",
            questionOrder: 1,
            sectionKey: source.sectionKey,
            snapshotReleaseId: TEST_RELEASE_ID,
            snapshotId: expect.any(String),
            sourcePath: source.questionSourcePath,
            sourceRevision: source.sourceRevision,
          },
          response: {
            kind: "single-choice",
            options: [
              {
                isCorrect: true,
                label: "A",
                optionKey: "option-1",
                order: 1,
              },
              {
                isCorrect: false,
                label: "B",
                optionKey: "option-2",
                order: 2,
              },
            ],
          },
        });
        expect(featured.question).not.toHaveProperty("answerArtifactHash");
        expect(featured.question).not.toHaveProperty("artifactLocale");
      })
  );

  it.effect(
    "does not expose an internal-entry section on the public landing",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateLandingSource(ctx, "internal-entry"))
        );

        const failure = yield* Effect.tryPromise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        ).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        });
      })
  );

  it.effect(
    "ignores an earlier section when selecting the landing question",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshotId = await activateTryoutSnapshot(ctx, {
              catalog: Arr.flatMap(
                ACTIVE_APP_LOCALE_CODES,
                makeLeadingSectionHierarchy
              ),
              placements: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) => [
                makeLeadingPlacement(locale),
                makeLandingPlacement(locale),
              ]),
            });
            await insertTestTryoutRuntimeBundle(ctx, snapshotId);
          })
        );

        const featured = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        );

        expect(featured.question.contentKey).toBe(
          LANDING_FEATURED_TRYOUT.questionContentKey
        );
      })
  );

  it.effect(
    "returns the stable authored question for every response format",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshotId = await activateTryoutSnapshot(ctx, {
              catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
                makeLandingHierarchy(locale, "visible")
              ),
              placements: Arr.map(
                ACTIVE_APP_LOCALE_CODES,
                makeMultipleChoicePlacement
              ),
            });
            await insertTestTryoutRuntimeBundle(ctx, snapshotId);
          })
        );

        const featured = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        );

        expect(featured.response.kind).toBe("multiple-choice");
        expect(featured.question.questionOrder).toBe(1);
      })
  );

  it.effect("returns a category response without narrowing its structure", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const snapshotId = await activateTryoutSnapshot(ctx, {
            catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
              makeLandingHierarchy(locale, "visible")
            ),
            placements: Arr.map(ACTIVE_APP_LOCALE_CODES, makeCategoryPlacement),
          });
          await insertTestTryoutRuntimeBundle(ctx, snapshotId);
        })
      );

      const featured = yield* Effect.promise(() =>
        t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
          appLocale: "id",
        })
      );

      expect(featured.response).toMatchObject({
        categories: [
          { categoryKey: "category-1" },
          { categoryKey: "category-2" },
        ],
        kind: "category",
        statements: [
          {
            correctCategoryKey: "category-1",
            statementKey: "statement-1",
          },
        ],
      });
    })
  );

  it.effect("requires one active signed hierarchy", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);

      const failure = yield* Effect.tryPromise(() =>
        t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
          appLocale: "id",
        })
      ).pipe(Effect.flip);
      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_MISSING" },
      });
    })
  );
});
