import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** Where a call starts: no cursor for the first page, then the `next` of the call before. */
const Cursor = Schema.NullOr(Schema.String);

/**
 * The turns one call reads. A turn holds ids, short strings and lists with a
 * stated maximum, and no message text, so it weighs kilobytes, and a document
 * may weigh at most 1 MiB. A mutation may read 16 MiB, write 16 MiB, scan
 * 32,000 documents and write 16,000 (https://docs.convex.dev/production/state/limits),
 * so a page of this size is far inside every limit.
 */
export const PAGE_SIZE = 100;

/**
 * Temporary function of step one of the change that makes a stored Nina turn
 * hold only what something reads (ADR 0001). A turn stored before it holds
 * fields that nothing reads. New turns are written without them, and the table
 * still admits them, so every reader takes a turn in either shape.
 *
 * Each call reads one page of turns after a cursor, by creation time, whatever
 * their state, and counts the ones in the old shape in `old`. With `dry` set it
 * writes nothing, which is the pass that counts the turns a real pass would
 * rewrite. Without `dry` it replaces each of them with the same turn without
 * those fields and counts it in `rewritten`, and it leaves a turn in the new
 * shape alone, so it can run again at any point. Start with
 * `{ cursor: null, dry: true }` and send each `next` back as the `cursor` of
 * the following call until it is null, which means there are no more turns. It
 * returns counts and a cursor, never a field of a turn.
 *
 * Owner: ADR 0001. Exit: it runs on dev and on production, dry first, and a dry
 * pass over every turn finds none in the old shape. Cleanup: step two deletes
 * this spec, its implementation and their tests, and narrows the stored
 * validator (`NinaStoredPageSchema` in `contract/turn.ts`) to the new shape.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "rewrite",
    args: () => ({ cursor: Cursor, dry: Schema.Boolean }),
    returns: () =>
      Schema.Struct({
        next: Cursor,
        old: Schema.Finite,
        rewritten: Schema.Finite,
      }),
  })
);
