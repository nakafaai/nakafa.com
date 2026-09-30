import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

const TurnOrder = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Tokens = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** Provider tokens one summary refresh spent. */
export const NinaSummaryCall = Schema.Struct({ input: Tokens, output: Tokens });

/**
 * A chat's rolling summary of every turn up to and including `throughOrder`.
 * Refreshes are chat upkeep rather than part of a turn's answer, so their
 * provider usage accumulates here instead of in a turn's usage ledger.
 */
export const NinaSummary = Schema.Struct({
  chatId: Id("chats"),
  text: Schema.String,
  throughOrder: TurnOrder,
  updatedAt: Schema.Finite,
  usage: Schema.Struct({
    ...NinaSummaryCall.fields,
    calls: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
});

/** The summary facts generation and refresh read back. */
export const NinaSummaryView = NinaSummary.mapFields((fields) => ({
  text: fields.text,
  throughOrder: fields.throughOrder,
}));

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({ chatId: Id("chats") }),
      returns: () => Schema.NullOr(NinaSummaryView),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "save",
      args: () => ({
        chatId: Id("chats"),
        text: Schema.String,
        throughOrder: TurnOrder,
        usage: NinaSummaryCall,
      }),
      returns: () => Schema.Null,
    })
  );
