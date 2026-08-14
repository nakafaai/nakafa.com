import type { StoredTryoutRow } from "@nakafa/aksara-contracts/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Effect, Schema } from "effect";

type FrozenTryoutPlacement = Pick<
  Doc<"tryoutAttemptPlacements">,
  | "answerArtifactHash"
  | "answerContentKey"
  | "choiceSnapshots"
  | "contentHash"
  | "questionArtifactHash"
  | "questionContentKey"
  | "questionOrder"
  | "rendererDomain"
  | "sectionKey"
  | "sourcePath"
  | "sourceRevision"
>;

type HistoricalTryoutPlacement = Extract<
  StoredTryoutRow,
  { readonly rowKind: "placement" }
>["record"]["row"];

/** Authenticated history facts proven identical to one frozen attempt row. */
export interface VerifiedStoredTryoutPlacement {
  readonly answerArtifactHash: HistoricalTryoutPlacement["answerArtifactHash"];
  readonly answerContentKey: HistoricalTryoutPlacement["answerContentKey"];
  readonly artifactLocale: HistoricalTryoutPlacement["locale"];
  readonly contentHash: string;
  readonly questionArtifactHash: HistoricalTryoutPlacement["questionArtifactHash"];
  readonly questionContentKey: HistoricalTryoutPlacement["questionContentKey"];
  readonly questionOrder: number;
  readonly questionSourcePath: HistoricalTryoutPlacement["questionSourcePath"];
  readonly sourceRevision: string;
}

/** One authenticated old placement differs from its attempt-owned frozen row. */
export class StoredTryoutPlacementMismatchError extends Schema.TaggedError<StoredTryoutPlacementMismatchError>()(
  "StoredTryoutPlacementMismatchError",
  {}
) {}

/** Checks ordered answer choices without normalizing historical bytes. */
function hasSameChoices(
  historical: HistoricalTryoutPlacement["choices"],
  frozen: FrozenTryoutPlacement["choiceSnapshots"]
) {
  return (
    historical.length === frozen.length &&
    historical.every((choice, index) => {
      const candidate = frozen[index];
      return (
        candidate !== undefined &&
        choice.isCorrect === candidate.isCorrect &&
        choice.label === candidate.label &&
        choice.optionKey === candidate.optionKey &&
        choice.order === candidate.order
      );
    })
  );
}

/** Proves one authenticated old placement is identical to its frozen copy. */
export const verifyStoredTryoutPlacement = Effect.fn(
  "tryouts.history.verifyStoredPlacement"
)(function* (
  historical: HistoricalTryoutPlacement,
  frozen: FrozenTryoutPlacement
) {
  const contentHash = historical.contentHash;
  const matchesFrozen =
    historical.answerArtifactHash === frozen.answerArtifactHash &&
    historical.answerContentKey === frozen.answerContentKey &&
    contentHash !== undefined &&
    contentHash === frozen.contentHash &&
    historical.questionArtifactHash === frozen.questionArtifactHash &&
    historical.questionContentKey === frozen.questionContentKey &&
    historical.questionOrder === frozen.questionOrder &&
    historical.questionSourcePath === frozen.sourcePath &&
    historical.rendererDomain === frozen.rendererDomain &&
    historical.sectionKey === frozen.sectionKey &&
    historical.sourceRevision === frozen.sourceRevision &&
    hasSameChoices(historical.choices, frozen.choiceSnapshots);
  if (!matchesFrozen || contentHash === undefined) {
    return yield* new StoredTryoutPlacementMismatchError();
  }

  return {
    answerArtifactHash: historical.answerArtifactHash,
    answerContentKey: historical.answerContentKey,
    artifactLocale: historical.locale,
    contentHash,
    questionArtifactHash: historical.questionArtifactHash,
    questionContentKey: historical.questionContentKey,
    questionOrder: historical.questionOrder,
    questionSourcePath: historical.questionSourcePath,
    sourceRevision: historical.sourceRevision,
  } satisfies VerifiedStoredTryoutPlacement;
});
