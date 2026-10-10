import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** Where a call starts: no cursor for the first page, then the `next` of the call before. */
const Cursor = Schema.NullOr(Schema.String);

/** What one call did to one table: rows sealed, and where the next call starts. */
const SealPage = Schema.Struct({
  next: Cursor,
  sealed: Schema.Finite,
});

/**
 * Temporary migration of the expand step that seals chat titles and summary
 * texts. Every new write is sealed already, and rows written before October
 * 2026 still hold plain text. Each function reads one page of one table after
 * a cursor, seals the rows that still hold a string, and leaves sealed rows
 * alone, so it can run again at any point. Start each with `{ cursor: null }`
 * and send each `next` back as the `cursor` of the following call until it is
 * null, which means the table has no more rows. The two are separate functions
 * because Convex allows one paginated read in a function. The cursor is the
 * database's own, so rows that share a creation time are not skipped.
 *
 * `sealSummaries` also deletes the summaries whose chat is gone. Only the chat
 * owner's key seals a summary, and nothing can read one without its chat, so
 * leaving it plain would keep conversation text readable in an export; the chat
 * cleanup would have deleted it already, had it run. `removed` counts them.
 *
 * It runs on dev and on production until a whole pass from `null` seals and
 * removes nothing in both tables, and it is deleted together with the string
 * form of both fields in the contract change.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sealChats",
      args: () => ({ cursor: Cursor }),
      returns: () => SealPage,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sealSummaries",
      args: () => ({ cursor: Cursor }),
      returns: () =>
        Schema.Struct({ ...SealPage.fields, removed: Schema.Finite }),
    })
  );
