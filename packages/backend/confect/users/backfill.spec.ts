import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** Where a call starts: no cursor for the first page, then the `next` of the call before. */
const Cursor = Schema.NullOr(Schema.String);

/**
 * Temporary backfill of the animal that every account holds. An account made
 * from now on gets its animal when it is made, and the accounts made before the
 * field existed hold none.
 *
 * Each call reads one page of accounts after a cursor, oldest first. It counts
 * every account of the page that holds no animal, deleted accounts included, as
 * `waiting`. With `dry` set it writes nothing, which is the pass that counts the
 * accounts a real pass would give an animal. Without `dry` it gives each of them
 * the animal of its auth id and counts them in `assigned`, and it leaves every
 * other account as it is, so it can run again at any point. Start with
 * `{ cursor: null, dry: true }` and send each `next` back as the `cursor` of the
 * following call until it is null, which means there are no more accounts.
 *
 * Owner: docs/adr/0009-identity.md, beside the usernames. Exit: it runs on dev
 * and on production, dry first, and a dry pass over every account finds none
 * waiting. Cleanup: delete this spec, its implementation, their tests, and their
 * generated bindings in the next change, which makes `mascot` required.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "assignMascots",
    args: () => ({ cursor: Cursor, dry: Schema.Boolean }),
    returns: () =>
      Schema.Struct({
        assigned: Schema.Finite,
        next: Cursor,
        waiting: Schema.Finite,
      }),
  })
);
