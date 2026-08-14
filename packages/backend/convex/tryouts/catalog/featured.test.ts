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
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
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
} from "@repo/backend/test/tryout-source";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

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

  return Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))([
    ...privateFirstHierarchy,
    ...publicSecondSet,
  ]);
}

/** Moves the technical placement into the public second set. */
function makeSecondSetPlacement(locale: ActiveAppLocaleCode) {
  const placement = makeTryoutStartPlacement(locale);
  const moveToSecondSet = (value: string) =>
    value.replace(FIRST_SOURCE_SEGMENT, SECOND_SOURCE_SEGMENT);

  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
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

  return Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))([
    ...privateFirstTrack,
    ...publicSecondTrack,
  ]);
}

/** Moves the public technical placement into the second authored track. */
function makeSecondTrackPlacement(locale: ActiveAppLocaleCode) {
  return Schema.decodeUnknownSync(TryoutPlacementSchema)({
    ...makeSecondSetPlacement(locale),
    trackKey: SECOND_TRACK,
  });
}

describe("tryouts/catalog/featured", () => {
  it("returns the first visible signed question for the public landing demo", async () => {
    const t = convexTest(schema, convexModules);
    const source = makeTryoutStartPlacement("id");
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"));

    const featured = await t.query((ctx) =>
      runConvexProgram(readFeaturedTryout(ctx, "id"))
    );

    expect(featured).toEqual({
      choices: [
        {
          isCorrect: true,
          label: "A",
          optionKey: "option-1",
          order: 1,
        },
      ],
      question: {
        artifactHash: source.questionArtifactHash,
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
    });
    expect(featured.question).not.toHaveProperty("answerArtifactHash");
  });

  it("does not expose an internal-entry section on the public landing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "internal-entry"));

    await expect(
      t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("continues to the next set when the first set has no visible section", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: ACTIVE_APP_LOCALE_CODES.flatMap(
          makeInternalThenVisibleCatalog
        ),
        placements: ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
          makeTryoutStartPlacement(locale),
          makeSecondSetPlacement(locale),
        ]),
      })
    );

    const featured = await t.query((ctx) =>
      runConvexProgram(readFeaturedTryout(ctx, "id"))
    );

    expect(featured.question.contentKey).toContain(
      `/${TRYOUT_REUSED_SECTION}/${TRYOUT_REUSED_SET}/`
    );
  });

  it("continues to the next track when the first track is private", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: ACTIVE_APP_LOCALE_CODES.flatMap(
          makeInternalTrackThenVisibleCatalog
        ),
        placements: ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
          makeTryoutStartPlacement(locale),
          makeSecondTrackPlacement(locale),
        ]),
      })
    );

    const featured = await t.query((ctx) =>
      runConvexProgram(readFeaturedTryout(ctx, "id"))
    );

    expect(featured.question.contentKey).toContain(
      `/${TRYOUT_REUSED_SECTION}/${TRYOUT_REUSED_SET}/`
    );
  });

  it("requires one active signed hierarchy", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });
});
