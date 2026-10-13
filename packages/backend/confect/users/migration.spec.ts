import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * Temporary migration of the expand step that gives every account a username.
 * Accounts made from now on get theirs when they are made, and the accounts
 * made before hold none. `allocateUsernames` reads one page of accounts after
 * a cursor, oldest first, so the oldest account gets the plain form of a name.
 * It gives a username to each live account that holds none, and leaves every
 * other account as it is, so it can run again at any point. Start with
 * `{ cursor: null }` and send each `next` back as the `cursor` of the next
 * call until it is null, which means no account is left to read.
 *
 * It runs on dev and on production until a whole pass from `null` allocates
 * nothing, and it is deleted with its tests once both passes are clean.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "allocateUsernames",
    args: () => ({ cursor: Schema.NullOr(Schema.String) }),
    returns: () =>
      Schema.Struct({
        allocated: Schema.Finite,
        next: Schema.NullOr(Schema.String),
      }),
  })
);
