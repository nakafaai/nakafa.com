import type { TryoutSectionContent } from "@repo/backend/confect/tryouts/runtime/spec";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import {
  Array as Arr,
  Data,
  Effect,
  HashMap,
  Option,
  Result,
  Schema,
} from "effect";

/** Decodes one language of a question: its JSON text, beside its language and item version. */
const decodeVersion = Effect.fn("www.tryout.content.decodeVersion")(function* (
  version: TryoutSectionContent[number]["versions"][number]
) {
  const decoded = yield* Schema.decodeEffect(TryoutQuestionBodyText)(
    version.body
  );
  return { ...decoded, hash: version.hash, language: version.language };
});

/**
 * Decodes the question bodies a page carries, in question order: each question's placement and its
 * body in every language of its section, in the section's order. A document can nest deeper than a
 * Convex value may, so the backend sends each body as text and the page decodes it with the backend's
 * own schema.
 */
export const decodeTryoutBodies = Effect.fn("www.tryout.content.decodeBodies")(
  function* (content: TryoutSectionContent) {
    return yield* Effect.forEach(content, ({ placementId, versions }) =>
      Effect.gen(function* () {
        const [first, ...rest] = versions;
        const head = yield* decodeVersion(first);
        const tail = yield* Effect.forEach(rest, decodeVersion);
        return { placementId, versions: Arr.prepend(tail, head) };
      })
    );
  }
);

/** One decoded question of a page: its placement and its body in each language of its section. */
export type TryoutBody = Effect.Success<
  ReturnType<typeof decodeTryoutBodies>
>[number];

/** One language of a question: its prompt, interaction, reading, and, in a review, key and explanation. */
export type TryoutBodyVersion = TryoutBody["versions"][number];

/** A section's questions that the bodies beside them do not all cover, or not in the language shown. */
class TryoutBodiesMissing extends Data.TaggedError("TryoutBodiesMissing") {}

/**
 * Pairs each question of a section with its body in one language of the section, the one the section
 * shows, in question order, by its placement. The page read sends a body in every language of the
 * section for every question of the runtime it sends, so a question without one, or without that
 * language, is a broken read and fails as `TryoutBodiesMissing`: a section that shows some of its
 * questions, or none, is wrong.
 */
export function joinTryoutBodies<
  Question extends { readonly placementId: TryoutBody["placementId"] },
>(
  bodies: readonly TryoutBody[],
  questions: readonly Question[],
  language: string
) {
  const byPlacement = HashMap.fromIterable(
    Arr.map(bodies, (body) => [body.placementId, body] as const)
  );
  const joined = Arr.getSomes(
    Arr.map(questions, (question) =>
      Option.map(
        Option.flatMap(HashMap.get(byPlacement, question.placementId), (body) =>
          Arr.findFirst(
            body.versions,
            (version) => version.language === language
          )
        ),
        (body) => ({ body, question })
      )
    )
  );
  return joined.length === questions.length
    ? Result.succeed(joined)
    : Result.fail(new TryoutBodiesMissing());
}
