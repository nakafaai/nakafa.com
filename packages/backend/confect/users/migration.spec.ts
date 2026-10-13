import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** Where a call starts: no cursor for the first page, then the `next` of the call before. */
const Cursor = Schema.NullOr(Schema.String);

/**
 * Temporary migration of the expand step that gives every account a username.
 * An account made from now on gets its username when it is made, and the
 * accounts made before hold none.
 *
 * Each call reads one page of accounts after a cursor, oldest first, so the
 * oldest account gets the plain form of a name. It counts the live accounts of
 * the page that hold no username (`waiting`). With `dry` set it writes nothing,
 * which is the pass that counts the accounts a real pass would name. Without
 * `dry` it gives each of them a username and counts them in `allocated`, and
 * leaves every other account as it is, so it can run again at any point. Start
 * with `{ cursor: null, dry: true }` and send each `next` back as the `cursor`
 * of the following call until it is null, which means there are no more
 * accounts.
 *
 * Owner: the usernames section of ADR 0009. Exit: it runs on dev and on
 * production, dry first, and a dry pass over every account finds none waiting.
 * Cleanup: delete this spec, its implementation, their tests, and their
 * generated bindings in the next change. The schema keeps `username` optional,
 * because a deleted account holds none, so that change alters no stored shape.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "allocateUsernames",
    args: () => ({ cursor: Cursor, dry: Schema.Boolean }),
    returns: () =>
      Schema.Struct({
        allocated: Schema.Finite,
        next: Cursor,
        waiting: Schema.Finite,
      }),
  })
);
