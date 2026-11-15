import type { PlacementSchema } from "@nakafa/aksara-contracts/assessment/paper";
import type { ContentLanguage } from "@nakafa/aksara-contracts/locale";
import {
  readItemVersion,
  readStimulus,
} from "@repo/backend/confect/tryouts/rows";
import { tryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Reads one place as a learner reads it in one language: the hash of that language's item version,
 * its prompt, its one interaction with the labels written in that language, and the document of the
 * shared reading the version was written against, none without one. Every reader of a question's words
 * reads through here, the exam page, its review, Nina, and the landing's featured question, so nothing
 * else picks a version. A language the place holds no version in fails as
 * `TRYOUT_QUESTION_LANGUAGE_UNAVAILABLE`.
 */
export const placeVersion = Effect.fn("tryouts.runtime.placeVersion")(
  function* (
    // A paper's place and a frozen placement both hold the versions in the section's order.
    place: Pick<typeof PlacementSchema.Type, "versions">,
    language: ContentLanguage
  ) {
    const placed = Arr.findFirst(
      place.versions,
      (version) => version.language === language
    );
    if (Option.isNone(placed)) {
      return yield* tryoutRuntimeError(
        "TRYOUT_QUESTION_LANGUAGE_UNAVAILABLE",
        `The place holds no version in ${language}.`
      );
    }
    const version = yield* readItemVersion(placed.value.hash);
    const stimulus =
      version.stimulus === undefined
        ? Option.none()
        : Option.some((yield* readStimulus(version.stimulus.hash)).document);
    return {
      hash: version.hash,
      interaction: Arr.headNonEmpty(version.interactions),
      language,
      prompt: version.prompt,
      stimulus,
    };
  }
);
export type PlacedQuestionVersion = Effect.Success<
  ReturnType<typeof placeVersion>
>;
