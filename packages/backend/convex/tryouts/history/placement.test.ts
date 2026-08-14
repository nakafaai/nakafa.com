import { decodeStoredTryoutRow } from "@nakafa/aksara-history/history/decode";
import {
  StoredTryoutPlacementMismatchError,
  verifyStoredTryoutPlacement,
} from "@repo/backend/convex/tryouts/history/placement";
import { RETAINED_RUNTIME_PLACEMENT_ROW } from "@repo/backend/test/retained-runtime";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Builds authenticated and frozen views of the same fixed history vector. */
const readPlacementPair = Effect.fn("test.readHistoricalTryoutPlacementPair")(
  function* () {
    const row = yield* decodeStoredTryoutRow(RETAINED_RUNTIME_PLACEMENT_ROW);
    if (row.rowKind !== "placement") {
      return yield* Effect.dieMessage("Expected one historical placement.");
    }
    const historical = row.record.row;
    return {
      frozen: {
        answerArtifactHash: historical.answerArtifactHash,
        answerContentKey: historical.answerContentKey,
        choiceSnapshots: historical.choices.map((choice) => ({ ...choice })),
        contentHash: historical.contentHash ?? "",
        questionArtifactHash: historical.questionArtifactHash,
        questionContentKey: historical.questionContentKey,
        questionOrder: historical.questionOrder,
        rendererDomain: historical.rendererDomain,
        sectionKey: historical.sectionKey,
        sourcePath: historical.questionSourcePath,
        sourceRevision: historical.sourceRevision,
        title: historical.title,
      },
      historical,
    };
  }
);

describe("tryouts/history/placement", () => {
  it("returns only facts proven by both authenticated and frozen rows", async () => {
    const { frozen, historical } = await Effect.runPromise(readPlacementPair());

    const verified = await Effect.runPromise(
      verifyStoredTryoutPlacement(historical, frozen)
    );

    expect(verified).toEqual({
      answerArtifactHash: historical.answerArtifactHash,
      answerContentKey: historical.answerContentKey,
      artifactLocale: historical.locale,
      contentHash: historical.contentHash,
      questionArtifactHash: historical.questionArtifactHash,
      questionContentKey: historical.questionContentKey,
      questionOrder: historical.questionOrder,
      questionSourcePath: historical.questionSourcePath,
      sourceRevision: historical.sourceRevision,
    });
    expect(verified).not.toHaveProperty("appLocale");
  });

  it("returns one typed failure for frozen field or choice drift", async () => {
    const { frozen, historical } = await Effect.runPromise(readPlacementPair());

    await expect(
      Effect.runPromise(
        verifyStoredTryoutPlacement(historical, {
          ...frozen,
          sourceRevision: "changed",
        }).pipe(Effect.flip)
      )
    ).resolves.toEqual(new StoredTryoutPlacementMismatchError());
    await expect(
      Effect.runPromise(
        verifyStoredTryoutPlacement(historical, {
          ...frozen,
          contentHash: "changed",
        }).pipe(Effect.flip)
      )
    ).resolves.toEqual(new StoredTryoutPlacementMismatchError());
    await expect(
      Effect.runPromise(
        verifyStoredTryoutPlacement(historical, {
          ...frozen,
          choiceSnapshots: frozen.choiceSnapshots.map((choice, index) =>
            index === 0 ? { ...choice, isCorrect: false } : choice
          ),
        }).pipe(Effect.flip)
      )
    ).resolves.toEqual(new StoredTryoutPlacementMismatchError());
  });
});
