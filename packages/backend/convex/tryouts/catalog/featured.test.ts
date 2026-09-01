import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readFeaturedTryout } from "@repo/backend/convex/tryouts/catalog/featured";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  activateTryoutStartSource,
  makeTryoutStartCatalog,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_REUSED_SECTION,
  TRYOUT_REUSED_SET,
  TRYOUT_START_CONTENT_HASH,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const FIRST_SOURCE_SEGMENT = `/${TRYOUT_START_SECTION}/${TRYOUT_START_SET}`;
const SECOND_SOURCE_SEGMENT = `/${TRYOUT_REUSED_SECTION}/${TRYOUT_REUSED_SET}`;
const SECOND_SET_PATH = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_REUSED_SET}`;
const SECOND_TRACK = "second-track";
const SECOND_TRACK_PATH = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${SECOND_TRACK}`;
const SECOND_TRACK_SET_PATH = `${SECOND_TRACK_PATH}/${TRYOUT_REUSED_SET}`;
type NestedCatalogRow = Extract<
  TryoutCatalogRow,
  { readonly kind: "section" | "set" | "track" }
>;

/** Gives copied fixture rows distinct graph identities. */
function makeSecondSetGraph(graph: TryoutCatalogRow["graph"]) {
  return {
    alignmentId: `${graph.alignmentId}:second`,
    assetId: `${graph.assetId}:second`,
    conceptId: `${graph.conceptId}:second`,
    learningObjectId: `${graph.learningObjectId}:second`,
    lensId: `${graph.lensId}:second`,
  };
}

/** Builds a hierarchy whose first set is private and second set is public. */
function makeInternalThenVisibleCatalog(locale: ActiveAppLocaleCode) {
  const privateFirstHierarchy = makeTryoutStartHierarchy(
    locale,
    "internal-entry"
  ).map((row) =>
    row.kind === "track"
      ? {
          ...row,
          questionCount: 2,
          sectionCount: 2,
          setCount: 2,
          visibleSectionCount: 1,
        }
      : row
  );
  const publicSecondSet = makeTryoutStartCatalog(locale, "visible").map(
    (row) => {
      const graph = makeSecondSetGraph(row.graph);
      if (row.kind === "set") {
        return {
          ...row,
          graph,
          order: 2,
          publicPath: SECOND_SET_PATH,
          setKey: TRYOUT_REUSED_SET,
          title: "Set 2",
        };
      }

      if (row.kind === "section") {
        return {
          ...row,
          graph,
          publicPath: `${SECOND_SET_PATH}/${TRYOUT_REUSED_SECTION}`,
          questionSourcePath: row.questionSourcePath.replace(
            FIRST_SOURCE_SEGMENT,
            SECOND_SOURCE_SEGMENT
          ),
          sectionKey: TRYOUT_REUSED_SECTION,
          setKey: TRYOUT_REUSED_SET,
          title: "Aljabar",
        };
      }

      return row;
    }
  );

  return Schema.decodeSync(Schema.Array(TryoutCatalogRowSchema))([
    ...privateFirstHierarchy,
    ...publicSecondSet,
  ]);
}

/** Moves the technical placement into the public second set. */
function makeSecondSetPlacement(locale: ActiveAppLocaleCode) {
  const placement = makeTryoutStartPlacement(locale);
  const moveToSecondSet = (value: string) =>
    value.replace(FIRST_SOURCE_SEGMENT, SECOND_SOURCE_SEGMENT);

  return Schema.decodeSync(TryoutPlacementSchema)({
    ...placement,
    answerContentKey: moveToSecondSet(placement.answerContentKey),
    questionContentKey: moveToSecondSet(placement.questionContentKey),
    questionSourcePath: moveToSecondSet(placement.questionSourcePath),
    sectionKey: TRYOUT_REUSED_SECTION,
    setKey: TRYOUT_REUSED_SET,
  });
}

/** Builds a hierarchy whose first track is private and second track is public. */
function makeInternalTrackThenVisibleCatalog(locale: ActiveAppLocaleCode) {
  const privateFirstTrack = makeTryoutStartHierarchy(locale, "internal-entry");
  const publicSecondTrack = makeTryoutStartHierarchy(locale, "visible")
    .filter(
      (row): row is NestedCatalogRow =>
        row.kind === "track" || row.kind === "set" || row.kind === "section"
    )
    .map((row) => {
      const graph = makeSecondSetGraph(row.graph);
      if (row.kind === "track") {
        return {
          ...row,
          graph,
          order: 2,
          publicPath: SECOND_TRACK_PATH,
          title: "Second track",
          trackKey: SECOND_TRACK,
        };
      }
      if (row.kind === "set") {
        return {
          ...row,
          graph,
          publicPath: SECOND_TRACK_SET_PATH,
          setKey: TRYOUT_REUSED_SET,
          title: "Set 2",
          trackKey: SECOND_TRACK,
        };
      }
      return {
        ...row,
        graph,
        publicPath: `${SECOND_TRACK_SET_PATH}/${TRYOUT_REUSED_SECTION}`,
        questionSourcePath: row.questionSourcePath.replace(
          FIRST_SOURCE_SEGMENT,
          SECOND_SOURCE_SEGMENT
        ),
        sectionKey: TRYOUT_REUSED_SECTION,
        setKey: TRYOUT_REUSED_SET,
        title: "Aljabar",
        trackKey: SECOND_TRACK,
      };
    });

  return Schema.decodeSync(Schema.Array(TryoutCatalogRowSchema))([
    ...privateFirstTrack,
    ...publicSecondTrack,
  ]);
}

/** Moves the public technical placement into the second authored track. */
function makeSecondTrackPlacement(locale: ActiveAppLocaleCode) {
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...makeSecondSetPlacement(locale),
    trackKey: SECOND_TRACK,
  });
}

/** Makes the first authored placement exercise the full response contract. */
function makeMultipleChoicePlacement(locale: ActiveAppLocaleCode) {
  const placement = makeTryoutStartPlacement(locale);
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
  const placement = makeTryoutStartPlacement(locale);
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
  it.effect(
    "returns the first visible signed question for the public landing demo",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const source = makeTryoutStartPlacement("id");
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );

        const featured = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
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
          t.mutation((ctx) => activateTryoutStartSource(ctx, "internal-entry"))
        );

        const failure = yield* Effect.tryPromise(() =>
          t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
        ).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        });
      })
  );

  it.effect(
    "continues to the next set when the first set has no visible section",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshotId = await activateTryoutSnapshot(ctx, {
              catalog: ACTIVE_APP_LOCALE_CODES.flatMap(
                makeInternalThenVisibleCatalog
              ),
              placements: ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
                makeTryoutStartPlacement(locale),
                makeSecondSetPlacement(locale),
              ]),
            });
            await insertTestTryoutRuntimeBundle(ctx, snapshotId);
          })
        );

        const featured = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
        );

        expect(featured.question.contentKey).toContain(
          `/${TRYOUT_REUSED_SECTION}/${TRYOUT_REUSED_SET}/`
        );
      })
  );

  it.effect(
    "returns the first authored question for every response format",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshotId = await activateTryoutSnapshot(ctx, {
              catalog: ACTIVE_APP_LOCALE_CODES.flatMap((locale) =>
                makeTryoutStartHierarchy(locale, "visible")
              ),
              placements: ACTIVE_APP_LOCALE_CODES.map(
                makeMultipleChoicePlacement
              ),
            });
            await insertTestTryoutRuntimeBundle(ctx, snapshotId);
          })
        );

        const featured = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
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
            catalog: ACTIVE_APP_LOCALE_CODES.flatMap((locale) =>
              makeTryoutStartHierarchy(locale, "visible")
            ),
            placements: ACTIVE_APP_LOCALE_CODES.map(makeCategoryPlacement),
          });
          await insertTestTryoutRuntimeBundle(ctx, snapshotId);
        })
      );

      const featured = yield* Effect.promise(() =>
        t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
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

  it.effect("continues to the next track when the first track is private", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const snapshotId = await activateTryoutSnapshot(ctx, {
            catalog: ACTIVE_APP_LOCALE_CODES.flatMap(
              makeInternalTrackThenVisibleCatalog
            ),
            placements: ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
              makeTryoutStartPlacement(locale),
              makeSecondTrackPlacement(locale),
            ]),
          });
          await insertTestTryoutRuntimeBundle(ctx, snapshotId);
        })
      );

      const featured = yield* Effect.promise(() =>
        t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
      );

      expect(featured.question.contentKey).toContain(
        `/${TRYOUT_REUSED_SECTION}/${TRYOUT_REUSED_SET}/`
      );
    })
  );

  it.effect("requires one active signed hierarchy", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);

      const failure = yield* Effect.tryPromise(() =>
        t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
      ).pipe(Effect.flip);
      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_MISSING" },
      });
    })
  );
});
