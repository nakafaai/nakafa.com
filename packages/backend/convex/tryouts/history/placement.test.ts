import { decodeStoredTryoutRow } from "@nakafa/aksara-contracts/history/decode";
import {
  StoredTryoutPlacementMismatchError,
  verifyStoredTryoutPlacement,
} from "@repo/backend/convex/tryouts/history/placement";
import { TEST_STORED_TRYOUT_PLACEMENT } from "@repo/backend/test/tryout-history";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const FROZEN_CONTENT_HASH = "f".repeat(64);
const CORPUS_ROOT_PATTERN = /^packages\/corpus\//;
/** Builds authenticated and frozen views of the same fixed history vector. */
const readPlacementPair = Effect.fn("test.readHistoricalTryoutPlacementPair")(
  function* () {
    const row = yield* decodeStoredTryoutRow(TEST_STORED_TRYOUT_PLACEMENT);
    if (row.rowKind !== "placement") {
      return yield* Effect.die(new Error("Expected one historical placement."));
    }
    const historical = row.record.row;
    return {
      frozen: {
        answerArtifactHash: historical.answerArtifactHash,
        answerContentKey: historical.answerContentKey,
        choiceSnapshots: historical.choices.map((choice) => ({ ...choice })),
        contentHash: FROZEN_CONTENT_HASH,
        questionArtifactHash: historical.questionArtifactHash,
        questionContentKey: historical.questionContentKey,
        questionOrder: historical.questionOrder,
        rendererDomain: historical.rendererDomain,
        sectionKey: historical.sectionKey,
        sourcePath: historical.questionSourcePath,
        sourceRevision: historical.sourceRevision,
      },
      historical,
    };
  }
);
describe("tryouts/history/placement", () => {
  it.live(
    "returns the attempt-owned hash after authenticating the signed row",
    () =>
      Effect.gen(function* () {
        const { frozen, historical } = yield* readPlacementPair();
        const verified = yield* verifyStoredTryoutPlacement(historical, frozen);
        expect(verified).toEqual({
          answerArtifactHash: historical.answerArtifactHash,
          answerContentKey: historical.answerContentKey,
          artifactLocale: historical.locale,
          contentHash: FROZEN_CONTENT_HASH,
          questionArtifactHash: historical.questionArtifactHash,
          questionContentKey: historical.questionContentKey,
          questionOrder: historical.questionOrder,
          questionSourcePath: historical.questionSourcePath,
          sourceRevision: historical.sourceRevision,
        });
        expect(verified).not.toHaveProperty("appLocale");
      })
  );
  it.live("returns one typed failure for frozen field or choice drift", () =>
    Effect.gen(function* () {
      const { frozen, historical } = yield* readPlacementPair();
      expect(
        yield* verifyStoredTryoutPlacement(historical, {
          ...frozen,
          sourceRevision: "changed",
        }).pipe(Effect.flip)
      ).toEqual(new StoredTryoutPlacementMismatchError());
      expect(
        yield* verifyStoredTryoutPlacement(historical, {
          ...frozen,
          choiceSnapshots: frozen.choiceSnapshots.map((choice, index) =>
            index === 0 ? { ...choice, isCorrect: false } : choice
          ),
        }).pipe(Effect.flip)
      ).toEqual(new StoredTryoutPlacementMismatchError());
    })
  );
  it.live("accepts a root-relative frozen source path", () =>
    Effect.gen(function* () {
      const { frozen, historical } = yield* readPlacementPair();
      const relativeSourcePath = historical.questionSourcePath.replace(
        CORPUS_ROOT_PATTERN,
        ""
      );
      expect(
        yield* verifyStoredTryoutPlacement(historical, {
          ...frozen,
          sourcePath: relativeSourcePath,
        })
      ).toMatchObject({ contentHash: FROZEN_CONTENT_HASH });
    })
  );
});
