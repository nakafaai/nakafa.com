import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Effect, Schema } from "effect";

/** A placement's interaction as the JSON text it is stored as. */
const InteractionText = Schema.fromJsonString(InteractionSchema);

/** A placement's key answer as the JSON text it is stored as. */
const KeyText = Schema.fromJsonString(InteractionKeySchema);

/** Encodes the interaction and key answer a placement freezes as the JSON text it stores. */
export const encodePlacedQuestion = Effect.fn(
  "tryouts.question.encodePlacedQuestion"
)(function* (question: {
  readonly interaction: typeof InteractionSchema.Type;
  readonly key: typeof InteractionKeySchema.Type;
}) {
  const [interactionJson, keyJson] = yield* Effect.all([
    Schema.encodeEffect(InteractionText)(question.interaction),
    Schema.encodeEffect(KeyText)(question.key),
  ]).pipe(
    // The contract decoded both from the snapshot, so it encodes both.
    Effect.orDie
  );
  return { interactionJson, keyJson };
});

/**
 * Decodes the interaction, key answer, and rule a placement froze. Only text the contract encoded is
 * stored, so a text it refuses is a defect.
 */
export const readPlacedQuestion = Effect.fn(
  "tryouts.question.readPlacedQuestion"
)(function* (
  placement: Pick<
    Docs["tryoutAttemptPlacements"],
    "interactionJson" | "keyJson" | "rule"
  >
) {
  const [interaction, key] = yield* Effect.all([
    Schema.decodeEffect(InteractionText)(placement.interactionJson),
    Schema.decodeEffect(KeyText)(placement.keyJson),
  ]).pipe(Effect.orDie);
  return { interaction, key, rule: placement.rule };
});
export type PlacedQuestion = Effect.Success<
  ReturnType<typeof readPlacedQuestion>
>;
