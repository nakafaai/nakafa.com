import { matchesAnswerKey } from "@nakafa/aksara-contracts/assessment/answer";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { matchesNumber } from "@repo/backend/confect/assessment/number";
import {
  type ExamResponse,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/assessment/response";
import { Array as Arr, Match, Option, Str } from "effect";

/** A question the learner answers by typing: a short answer, or a number with its unit, as SNBT sets them. */
export type Entry = Extract<
  Interaction,
  { readonly kind: "numericEntry" | "textEntry" }
>;

/** Whether the learner answers an interaction by typing it, as a short answer or a numeric answer. */
export const isEntry = (interaction: Interaction): interaction is Entry =>
  interaction.kind === "textEntry" || interaction.kind === "numericEntry";

/** The response of what the learner typed: the text, or none while it is blank, which clears the answer. */
export const entryResponse = (typed: string): ExamResponse | null =>
  Str.isNonEmpty(Str.trim(typed)) ? { text: typed } : null;

/** The decimal point of a locale's numbers: a comma in Indonesian and German, a period in English. */
export const decimalOf = (locale: string) =>
  Option.match(
    Arr.findFirst(
      new Intl.NumberFormat(locale).formatToParts(1.5),
      (part) => part.type === "decimal"
    ),
    { onNone: () => ".", onSome: (part) => part.value }
  );

/**
 * A typed answer under its key, as the review marks it: the learner's text, whether it earns the key by the rule
 * the server grades it with (`matchesAnswerKey` for a short answer, `matchesNumber` for a number), the tone of its
 * line, open while blank, and the answers the key accepts: each accepted text of a short answer, or the key's
 * number with the locale's decimal point and the entry's unit. A key of another kind accepts nothing here.
 */
export function reviewEntry({
  decimal,
  entry,
  key,
  response,
}: {
  readonly decimal: string;
  readonly entry: Entry;
  readonly key: InteractionKey;
  readonly response: ExamResponse | null;
}) {
  const text = typedText(response ?? NO_RESPONSE);
  const blank = !Str.isNonEmpty(Str.trim(text));
  const marked = Match.value({ entry, key }).pipe(
    Match.when(
      { entry: { kind: "numericEntry" }, key: { kind: "numericEntry" } },
      (numeric) => {
        const value = Str.replace(".", decimal)(numeric.key.value);
        return {
          accepted: [
            Option.match(Option.fromNullishOr(numeric.entry.unit), {
              onNone: () => value,
              onSome: (unit) => `${value} ${unit}`,
            }),
          ],
          earned: matchesNumber(numeric.entry, numeric.key, text),
        };
      }
    ),
    Match.when({ key: { kind: "textEntry" } }, (short) => ({
      accepted: short.key.accepted.acceptedAnswers,
      earned: matchesAnswerKey(short.key.accepted, text),
    })),
    Match.orElse(() => ({ accepted: [], earned: false }))
  );
  return {
    ...marked,
    blank,
    text,
    tone: Match.value({ blank, earned: marked.earned }).pipe(
      Match.when({ earned: true }, () => "correct" as const),
      Match.when({ blank: true }, () => "idle" as const),
      Match.orElse(() => "wrong" as const)
    ),
  };
}
