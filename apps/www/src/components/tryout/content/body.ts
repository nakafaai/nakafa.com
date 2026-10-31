import {
  TryoutQuestionBodyText,
  type TryoutSectionContent,
} from "@repo/backend/confect/tryouts/runtime/spec";
import {
  Array as Arr,
  Data,
  Effect,
  HashMap,
  Option,
  Result,
  Schema,
} from "effect";

/**
 * Decodes the question bodies a page carries, in question order: each body's JSON text with its
 * placement and item version. A document can nest deeper than a Convex value may, so the backend
 * sends each body as text and the page decodes it with the backend's own schema.
 */
export const decodeTryoutBodies = Effect.fn("www.tryout.content.decodeBodies")(
  function* (content: TryoutSectionContent) {
    return yield* Effect.forEach(
      content,
      ({ body, placementId, versionHash }) =>
        Effect.map(
          Schema.decodeEffect(TryoutQuestionBodyText)(body),
          (decoded) => ({
            ...decoded,
            placementId,
            versionHash,
          })
        )
    );
  }
);

/** One decoded question body of a page: its prompt, interaction, reading, and, in a review, key and explanation. */
export type TryoutBody = Effect.Success<
  ReturnType<typeof decodeTryoutBodies>
>[number];

/** A section's questions that the bodies beside them do not all cover. */
class TryoutBodiesMissing extends Data.TaggedError("TryoutBodiesMissing") {}

/**
 * Pairs each question of a section with its body, in question order, by its placement. The page read
 * sends a body for every question of the runtime it sends, so a question without one is a broken read
 * and fails as `TryoutBodiesMissing`: a section that shows some of its questions, or none, is wrong.
 */
export function joinTryoutBodies<
  Question extends { readonly placementId: TryoutBody["placementId"] },
>(bodies: readonly TryoutBody[], questions: readonly Question[]) {
  const byPlacement = HashMap.fromIterable(
    Arr.map(bodies, (body) => [body.placementId, body] as const)
  );
  const joined = Arr.getSomes(
    Arr.map(questions, (question) =>
      Option.map(HashMap.get(byPlacement, question.placementId), (body) => ({
        body,
        question,
      }))
    )
  );
  return joined.length === questions.length
    ? Result.succeed(joined)
    : Result.fail(new TryoutBodiesMissing());
}
