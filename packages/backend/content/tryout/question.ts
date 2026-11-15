import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  readExplanation,
  readItemKey,
} from "@repo/backend/confect/tryouts/rows";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import type { PlacedQuestionVersion } from "@repo/backend/confect/tryouts/runtime/version";
import { Array as Arr, Effect, Option, Schema } from "effect";

/**
 * One published question as a public page shows it with its key, in the language its place was read in
 * (`placeVersion`): the version's prompt and interaction, the key's answer for that interaction, the
 * reading the version was written against, and, when the page explains it, its explanation in the page's
 * language. A key without an answer for the interaction is a broken release.
 */
export const readKeyedQuestion = Effect.fn("tryouts.catalog.readKeyedQuestion")(
  function* (
    version: PlacedQuestionVersion,
    explained: Option.Option<AppLocaleCode>
  ) {
    const key = yield* readItemKey(version.hash);
    const answer = Arr.findFirst(
      key.answers,
      (candidate) => candidate.interaction === version.interaction.id
    );
    if (Option.isNone(answer)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `The key of item version ${version.hash} has no answer for ${version.interaction.id}.`
      );
    }
    const explanation = yield* Option.match(explained, {
      onNone: () => Effect.succeedNone,
      onSome: (locale) => readExplanation(version.hash, locale),
    });
    const body = yield* Schema.encodeEffect(TryoutQuestionBodyText)({
      interaction: version.interaction,
      key: answer.value,
      prompt: version.prompt,
      ...(Option.isSome(explanation) ? { explanation: explanation.value } : {}),
      ...(Option.isSome(version.stimulus)
        ? { stimulus: version.stimulus.value }
        : {}),
    }).pipe(
      // Every part was decoded by the contract, so it encodes.
      Effect.orDie
    );
    return { body, versionHash: version.hash };
  }
);
