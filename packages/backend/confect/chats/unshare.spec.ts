import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** Where a call starts: no cursor for the first page, then the `next` of the call before. */
const Cursor = Schema.NullOr(Schema.String);

/**
 * Temporary migration of the expand step that gives a shared chat a token. A
 * chat that was public before share tokens has no `chatShares` row, so no link
 * opens it, and its owner has no link to copy. No token is drawn for it unless
 * its owner asks: the chat goes back to private, and its owner shares it again
 * to get a link. The old link, which held only the chat id, stops working the
 * moment the new code is live, with or without this function.
 *
 * Each call reads one page of chats after a cursor and counts the public ones
 * (`shared` has a token, `legacy` has none). With `dry` set it writes nothing,
 * which is the pass that counts the chats a real pass would close. Without
 * `dry` it sets every legacy chat of the page to private and counts it in
 * `closed`, and leaves a chat that has a token alone, so it can run again at
 * any point. Start with `{ cursor: null, dry: true }` and send each `next`
 * back as the `cursor` of the following call until it is null, which means
 * there are no more chats.
 *
 * Owner: ADR 0001. Exit: it runs on dev and on production, dry first, and a dry
 * pass over every chat finds no legacy chat. Cleanup: delete this spec, its
 * implementation and their tests, in the change that also deletes `getChats`.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "closeLegacy",
    args: () => ({ cursor: Cursor, dry: Schema.Boolean }),
    returns: () =>
      Schema.Struct({
        closed: Schema.Finite,
        legacy: Schema.Finite,
        next: Cursor,
        shared: Schema.Finite,
      }),
  })
);
