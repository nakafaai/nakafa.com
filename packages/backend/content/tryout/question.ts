import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  readExplanation,
  readItemKey,
  readItemVersion,
  readStimulus,
} from "@repo/backend/confect/tryouts/rows";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { Array as Arr, Effect, Option, Schema } from "effect";

/**
 * One published question as a public page shows it with its key: the prompt and interaction of its item
 * version, the key's answer for that interaction, the reading the version was written against, and, when
 * the page explains it, its explanation in the page's language. A key without an answer for the
 * interaction is a broken release.
 */
export const readKeyedQuestion = Effect.fn("tryouts.catalog.readKeyedQuestion")(
  function* (versionHash: string, explained: Option.Option<AppLocaleCode>) {
    const [version, key] = yield* Effect.all([
      readItemVersion(versionHash),
      readItemKey(versionHash),
    ]);
    const interaction = Arr.headNonEmpty(version.interactions);
    const answer = Arr.findFirst(
      key.answers,
      (candidate) => candidate.interaction === interaction.id
    );
    if (Option.isNone(answer)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `The key of item version ${version.hash} has no answer for ${interaction.id}.`
      );
    }
    const stimulus =
      version.stimulus === undefined
        ? Option.none()
        : Option.some((yield* readStimulus(version.stimulus.hash)).document);
    const explanation = yield* Option.match(explained, {
      onNone: () => Effect.succeedNone,
      onSome: (locale) => readExplanation(version.hash, locale),
    });
    const body = yield* Schema.encodeEffect(TryoutQuestionBodyText)({
      interaction,
      key: answer.value,
      prompt: version.prompt,
      ...(Option.isSome(explanation) ? { explanation: explanation.value } : {}),
      ...(Option.isSome(stimulus) ? { stimulus: stimulus.value } : {}),
    }).pipe(
      // Every part was decoded by the contract, so it encodes.
      Effect.orDie
    );
    return { body, versionHash: version.hash };
  }
);
