import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What one call did to one table: rows sealed, and where the next call starts. */
const SealPage = Schema.Struct({
  next: Schema.NullOr(Schema.Finite),
  sealed: Schema.Finite,
});

/**
 * Temporary migration of the expand step that seals chat titles and summary
 * texts. Every new write is sealed already, and rows written before October
 * 2026 still hold plain text. One call scans one page of each table after a
 * creation time, seals the rows that still hold a string, and leaves sealed
 * rows alone, so it can run again at any point. Start with
 * `{ chats: 0, summaries: 0 }` and send each `next` back as the argument of
 * the following call; a `null` skips a table that has no more rows. It runs on
 * dev and on production until a whole pass seals nothing, and it is deleted
 * together with the string form of both fields in the contract change.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sealPlain",
    args: () => ({
      chats: Schema.NullOr(Schema.Finite),
      summaries: Schema.NullOr(Schema.Finite),
    }),
    returns: () => Schema.Struct({ chats: SealPage, summaries: SealPage }),
  })
);
