import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  NinaUpkeepCall,
  NinaUpkeepTotal,
} from "@repo/backend/confect/nina/contract/usage";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema, Struct } from "effect";

const TurnOrder = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * A chat's rolling summary of every turn up to and including `throughOrder`.
 * Refreshes are chat upkeep rather than part of a turn's answer, so their
 * provider usage accumulates here instead of in a turn's usage ledger.
 */
export const NinaSummary = Schema.Struct({
  chatId: Id("chats"),
  // Sealed for the learner who owns the chat (`nina/summaries/text`).
  text: Sealed,
  throughOrder: TurnOrder,
  updatedAt: Schema.Finite,
  usage: NinaUpkeepTotal,
});

/** The summary facts generation and refresh read back, with the text opened. */
const NinaSummaryView = NinaSummary.mapFields((fields) => ({
  text: Schema.String,
  throughOrder: fields.throughOrder,
}));

/**
 * Most turns one summary refresh folds, and so the most turns the read of
 * uncovered turns looks at: a fold never reaches past what that read shows.
 */
export const SUMMARY_FOLD_LIMIT = 16;

/**
 * A complete turn the summary does not cover. `retryOf` is the order of the
 * turn that first asked its question, when this turn asks it again.
 */
export const NinaUncoveredTurn = Schema.Struct({
  order: TurnOrder,
  retryOf: Schema.optionalKey(TurnOrder),
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({ chatId: Id("chats") }),
      returns: () => Schema.NullOr(NinaSummaryView),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "anchor",
      args: () => ({ chatId: Id("chats"), order: TurnOrder }),
      returns: () => Schema.NullOr(Schema.String),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "uncovered",
      args: () => ({
        chatId: Id("chats"),
        through: Schema.NullOr(TurnOrder),
        before: TurnOrder,
      }),
      returns: () => Schema.Array(NinaUncoveredTurn),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "asked",
      args: () => ({
        chatId: Id("chats"),
        questions: Schema.Array(TurnOrder).check(
          Schema.isMaxLength(SUMMARY_FOLD_LIMIT)
        ),
        before: TurnOrder,
      }),
      returns: () => Schema.Array(NinaUncoveredTurn),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "save",
      args: () => ({
        ...NinaSummary.mapFields(Struct.pick(["chatId", "throughOrder"]))
          .fields,
        // The caller sends plain text and the mutation seals it.
        text: Schema.String,
        usage: NinaUpkeepCall,
      }),
      returns: () => Schema.Null,
    })
  );
