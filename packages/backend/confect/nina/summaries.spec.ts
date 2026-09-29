import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

const TurnOrder = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** A chat's rolling summary of every turn up to and including `throughOrder`. */
export const NinaSummary = Schema.Struct({
  chatId: Id("chats"),
  text: Schema.String,
  throughOrder: TurnOrder,
  updatedAt: Schema.Finite,
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
      }),
      returns: () => Schema.Null,
    })
  );
