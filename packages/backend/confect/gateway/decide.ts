import { classify } from "@repo/backend/confect/gateway/classify";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { decisionDeadline } from "@repo/backend/confect/gateway/purpose";
import {
  type Experimental_DecisionModel as DecisionModelOrId,
  type Experimental_DecisionQuestion as DecisionQuestion,
  type Experimental_DecisionResult as DecisionResult,
  type Experimental_DecisionState as DecisionState,
  experimental_decide,
} from "ai";
import { Effect } from "effect";

/**
 * Retries after a failed attempt. This is the one retry policy of a decision:
 * the AI SDK retries only a failure the provider marks as retryable, waits
 * longer each time and honors `Retry-After`. It matches the SDK's own default
 * and is written out so that the policy is read here and not assumed.
 */
const RETRIES = 2;

/** A decision model object, as the provider hands it to the AI SDK. */
export type DecisionModel = Exclude<DecisionModelOrId, string>;

/** One typed question: a choice, a score, or a yes-or-no question. */
export type Question = DecisionQuestion;

/** The text, data or parts that every question of one decision is about. */
export type State = DecisionState;

/** The answers to a set of questions, typed by the question of each id. */
export type Answers<Questions extends Record<string, Question>> =
  DecisionResult<Questions>["answers"];

/**
 * Asks a decision model typed questions about one state in a single request,
 * and answers with one typed answer for each question. A failure of any kind
 * is classified like the failures of a language call (`classify`), and a
 * request that is still open after `decisionDeadline` is aborted and fails as a
 * timeout. The model carries the zero data retention request.
 */
export const decideWith = Effect.fn("gateway.decide")(function* <
  const Questions extends Record<string, Question>,
>(model: DecisionModel, state: State, questions: Questions) {
  const result = yield* Effect.tryPromise({
    try: (signal) =>
      experimental_decide({
        abortSignal: signal,
        maxRetries: RETRIES,
        model,
        questions,
        state,
      }),
    catch: classify,
  }).pipe(
    Effect.timeoutOrElse({
      duration: decisionDeadline,
      orElse: () => Effect.fail(new GatewayFailure({ reason: "timeout" })),
    })
  );
  return result.answers;
});
