import { QuestionResponseSchema } from "@nakafa/aksara-contracts/question/response";
import { Effect, Schema } from "effect";

const PredecessorChoiceSchema = Schema.Struct({
  isCorrect: Schema.Boolean,
  label: Schema.String,
  optionKey: Schema.String,
  order: Schema.Finite,
});

const FeaturedResponseSchema = Schema.Union([
  Schema.Struct({ response: QuestionResponseSchema }),
  Schema.Struct({ choices: Schema.Array(PredecessorChoiceSchema) }),
]);

/** Expected failure when the deployed featured response matches no contract. */
export class FeaturedTryoutResponseError extends Schema.TaggedError<FeaturedTryoutResponseError>()(
  "FeaturedTryoutResponseError",
  { cause: Schema.Unknown }
) {}

/**
 * Reads the featured response across the one deployment where web and backend
 * switch from predecessor choices to the canonical response contract.
 *
 * Remove this boundary after the canonical backend and web deployment are live.
 */
export const decodeFeaturedResponse = Effect.fn(
  "tryouts.catalog.decodeFeaturedResponse"
)(
  function* (input: unknown) {
    const featured = yield* Schema.decodeUnknownEffect(FeaturedResponseSchema, {
      onExcessProperty: "ignore",
    })(input);
    if ("response" in featured) {
      return featured.response;
    }
    return yield* Schema.decodeEffect(QuestionResponseSchema, {
      onExcessProperty: "error",
    })({
      kind: "single-choice",
      options: featured.choices,
    });
  },
  Effect.mapError((cause) => new FeaturedTryoutResponseError({ cause }))
);
