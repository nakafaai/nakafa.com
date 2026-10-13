import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** Where a call starts: no cursor for the first call, then the `next` of the call before. */
const Cursor = Schema.NullOr(Schema.String);

/**
 * Temporary migration that deletes everything the first School left behind.
 * Its code is gone, so nothing can write to its 16 tables any more: the 15
 * `school*` tables and `accountDeletionSchoolTransfers`. The migration removes
 * every row of them, every stored file their rows name, every scheduled job
 * that would publish a class material, and every forum post from the two
 * forum aggregates, which keep an empty tree for each forum until they are
 * unmounted. It also clears the school fields that
 * `accountDeletionPreparations` still holds.
 *
 * Each call works through the tables in a fixed order, children before parents,
 * and handles one bounded page of the first table that still has rows. `rows`
 * counts that page by table, `files` the stored files it removed, and `jobs`
 * the scheduled jobs it canceled. With `dry` set it only counts, so the same
 * pass shows what a real pass would remove. Start with
 * `{ cursor: null, dry: true }` and send each `next` back as the `cursor` of
 * the following call until it is null, which means every table is empty. A real
 * pass can run again at any point, and a dry pass that ends at once with
 * nothing counted is the proof that the tables are empty.
 *
 * Owner: ADR 0011. Exit: it runs on dev and on production, and a dry pass over
 * each finds nothing. Cleanup: the change that drops the 16 tables and their
 * `accountDeletionPreparations` fields deletes this spec, its implementation,
 * their tests, and the validators in `confect/schools` and `confect/classes`.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "erase",
    args: () => ({ cursor: Cursor, dry: Schema.Boolean }),
    returns: () =>
      Schema.Struct({
        files: Schema.Finite,
        jobs: Schema.Finite,
        next: Cursor,
        rows: Schema.Record(Schema.String, Schema.Finite),
      }),
  })
);
