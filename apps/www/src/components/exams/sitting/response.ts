import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr, Option, Result } from "effect";

/** The choice interaction, whose response is the options the student chose. */
export type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/** A written interaction: a short answer's text entry or an essay's long text, whose response is text. */
export type Written = Extract<
  Interaction,
  { readonly kind: "extendedText" | "textEntry" }
>;

/**
 * The written interaction of a question, when the question holds exactly one interaction and that
 * interaction is a text entry or a long text, as a short answer and an essay do. This is the rule that
 * the server applies.
 */
export function writtenOf(
  interactions: readonly Interaction[]
): Option.Option<Written> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is Written =>
      interaction.kind === "textEntry" || interaction.kind === "extendedText"
  );
}

/**
 * The choice of a question, when the question holds exactly one interaction and that interaction
 * is a choice. Any other question takes no response, so the screen offers it no option. This is
 * the rule that the server applies, so the screen never offers an option the server refuses.
 */
export function choiceOf(
  interactions: readonly Interaction[]
): Option.Option<Choice> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is Choice => interaction.kind === "choice"
  );
}

/**
 * The response after one option of a multiple choice is checked or unchecked. Checking adds the
 * option while the response holds fewer options than the choice takes, and unchecking removes it.
 * A check beyond the maximum leaves the response as it was.
 */
export function toggleOption(
  response: readonly string[],
  optionId: string,
  checked: boolean,
  maxChoices: number
): readonly string[] {
  if (!checked) {
    return Arr.filter(response, (id) => id !== optionId);
  }
  if (Arr.contains(response, optionId) || response.length >= maxChoices) {
    return response;
  }
  return Arr.append(response, optionId);
}

/** The match interaction, whose response is the pairs the student made. */
export type MatchPart = Extract<Interaction, { readonly kind: "match" }>;

/**
 * The match of a question, when the question holds exactly one interaction and that interaction is a
 * match, as a matching question does. This is the rule that the server applies.
 */
export function pairingOf(
  interactions: readonly Interaction[]
): Option.Option<MatchPart> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is MatchPart => interaction.kind === "match"
  );
}

/** One pair of a match, as the contract names it: a statement and the answer the student or the key gives it. */
type Pair = Extract<InteractionKey, { kind: "match" }>["pairs"][number];

/**
 * The pairs once one statement takes one answer: the statement's earlier pair is replaced, and a statement
 * that held this answer gives it up, since each answer pairs one statement. The pairs keep the order of the
 * match's statements, and a pair of a statement the match does not hold is dropped.
 */
export function pairedWith(
  sources: readonly { readonly id: string }[],
  pairs: readonly Pair[],
  next: Pair
): readonly Pair[] {
  const all = Arr.append(
    Arr.filter(
      pairs,
      (pair) => pair.source !== next.source && pair.target !== next.target
    ),
    next
  );
  return Arr.filterMap(sources, (source) =>
    Option.match(
      Arr.findFirst(all, (pair) => pair.source === source.id),
      { onNone: () => Result.failVoid, onSome: Result.succeed }
    )
  );
}
