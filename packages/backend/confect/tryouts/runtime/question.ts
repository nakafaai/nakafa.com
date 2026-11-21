import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { ScoringRuleSchema } from "@nakafa/aksara-contracts/assessment/scoring";
import { InteractionStructure } from "@repo/backend/confect/assessment/structure";
import { Array as Arr, Effect, Schema } from "effect";

/**
 * A placement's interaction structure as the JSON text it is stored as. Encoding a contract interaction
 * through it drops every word, so the text holds what every language of the item shares.
 */
const InteractionText = Schema.fromJsonString(InteractionStructure);

/** A placement's key answer as the JSON text it is stored as. */
const KeyText = Schema.fromJsonString(InteractionKeySchema);

/** One interaction of a frozen question as a row stores it: its structure and key answer as JSON text, and its rule. */
const StoredInteraction = Schema.Struct({
  interactionJson: Schema.String,
  keyJson: Schema.String,
  rule: ScoringRuleSchema,
});

/**
 * The fields of one frozen question, in a try-out's placement and a practice's question alike: its first
 * interaction in `interactionJson`, `keyJson` and `rule`, and each later one, in the item's order, in
 * `laterInteractions`, which a question of one interaction leaves out.
 */
export const placedQuestionFields = {
  ...StoredInteraction.fields,
  laterInteractions: Schema.optionalKey(
    Schema.NonEmptyArray(StoredInteraction)
  ),
};

/** The stored fields a frozen question is read from. */
const StoredQuestion = Schema.Struct(placedQuestionFields);

/** Encodes the interaction structure and key answer of one interaction as the JSON text a row stores. */
export const encodePlacedInteraction = Effect.fn(
  "tryouts.question.encodePlacedInteraction"
)(function* (placed: {
  readonly interaction: InteractionStructure;
  readonly key: typeof InteractionKeySchema.Type;
}) {
  const [interactionJson, keyJson] = yield* Effect.all([
    Schema.encodeEffect(InteractionText)(placed.interaction),
    Schema.encodeEffect(KeyText)(placed.key),
  ]).pipe(
    // The contract decoded both from the snapshot, so it encodes both.
    Effect.orDie
  );
  return { interactionJson, keyJson };
});

/** Encodes one frozen interaction with its rule, as `placedQuestionFields` stores each. */
const encodeStored = (placed: PlacedInteraction) =>
  Effect.map(encodePlacedInteraction(placed), (texts) => ({
    ...texts,
    rule: placed.rule,
  }));

/**
 * Encodes the interactions a question froze, in the item's order, as the fields it stores
 * (`placedQuestionFields`).
 */
export const encodePlacedQuestion = Effect.fn(
  "tryouts.question.encodePlacedQuestion"
)(function* (
  interactions: readonly [PlacedInteraction, ...PlacedInteraction[]]
) {
  const [first, ...later] = interactions;
  const head = yield* encodeStored(first);
  const tail = yield* Effect.forEach(later, encodeStored);
  return {
    ...head,
    ...(Arr.isReadonlyArrayNonEmpty(tail) ? { laterInteractions: tail } : {}),
  };
});

/** Decodes one stored interaction. Only text the contract encoded is stored, so a text it refuses is a defect. */
const readStored = Effect.fn("tryouts.question.readStored")(function* (
  stored: typeof StoredInteraction.Type
) {
  const [interaction, key] = yield* Effect.all([
    Schema.decodeEffect(InteractionText)(stored.interactionJson),
    Schema.decodeEffect(KeyText)(stored.keyJson),
  ]).pipe(Effect.orDie);
  return { interaction, key, rule: stored.rule };
});

/**
 * Decodes the interactions a question froze, in the item's order: each one's structure, key answer, and rule. A
 * question of one interaction holds one.
 */
export const readPlacedQuestion = Effect.fn(
  "tryouts.question.readPlacedQuestion"
)(function* (placement: typeof StoredQuestion.Type) {
  const head = yield* readStored(placement);
  const tail = yield* Effect.forEach(
    placement.laterInteractions ?? [],
    readStored
  );
  return { interactions: Arr.prepend(tail, head) };
});
export type PlacedQuestion = Effect.Success<
  ReturnType<typeof readPlacedQuestion>
>;

/** One interaction a question froze: its structure without words, the key's answer for it, and its rule. */
export type PlacedInteraction = PlacedQuestion["interactions"][number];
