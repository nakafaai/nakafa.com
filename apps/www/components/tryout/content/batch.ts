import { MAX_PROTECTED_RUNTIME_SELECTORS } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { Array as Arr, Effect, MutableList, Schema } from "effect";

/** Ordered selector batches plus the question and answer partition boundary. */
export interface TryoutContentBatchPlan<Selector> {
  readonly batches: readonly (readonly Selector[])[];
  readonly questionCount: number;
  readonly selectorCount: number;
}

/** A rendered batch no longer matches its immutable selector plan. */
export class TryoutContentBatchOrderError extends Schema.TaggedError<TryoutContentBatchOrderError>()(
  "TryoutContentBatchOrderError",
  {}
) {}

/** Plans bounded question-first batches without changing selector order. */
export function planTryoutContentBatches<Question, Answer>(
  questions: readonly Question[],
  answers: readonly Answer[]
): TryoutContentBatchPlan<Question | Answer> {
  const selectors: readonly (Question | Answer)[] = [...questions, ...answers];
  const batches = MutableList.make<readonly (Question | Answer)[]>();
  for (
    let start = 0;
    start < selectors.length;
    start += MAX_PROTECTED_RUNTIME_SELECTORS
  ) {
    MutableList.append(
      batches,
      Arr.take(Arr.drop(selectors, start), MAX_PROTECTED_RUNTIME_SELECTORS)
    );
  }
  return {
    batches: MutableList.toArray(batches),
    questionCount: questions.length,
    selectorCount: selectors.length,
  };
}

/** Restores question and answer partitions after ordered batch rendering. */
export const restoreTryoutContentOrder = Effect.fn(
  "NakafaContent.restoreTryoutContentOrder"
)(function* <Entry>(
  plan: TryoutContentBatchPlan<unknown>,
  renderedBatches: readonly (readonly Entry[])[]
) {
  if (renderedBatches.length !== plan.batches.length) {
    return yield* new TryoutContentBatchOrderError();
  }
  const sameBatchShape = Arr.every(
    plan.batches,
    (batch, index) => batch.length === renderedBatches[index]?.length
  );
  if (!sameBatchShape) {
    return yield* new TryoutContentBatchOrderError();
  }
  const entries = Arr.flatten(renderedBatches);
  if (entries.length !== plan.selectorCount) {
    return yield* new TryoutContentBatchOrderError();
  }
  return {
    answers: Arr.drop(entries, plan.questionCount),
    questions: Arr.take(entries, plan.questionCount),
  };
});
