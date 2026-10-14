import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/users/backfill.spec";
import { accountMascot } from "@repo/backend/confect/users/mascot";
import { Array as Arr, Effect, Layer, Struct } from "effect";

/**
 * Accounts one call reads. Each account that waits takes one write of the row
 * the page loaded, so a call stays far below the transaction limits and ends
 * well inside the time a mutation may run.
 */
const PAGE_SIZE = 50;

const assignMascots = FunctionImpl.make(
  databaseSchema,
  spec,
  "assignMascots",
  Effect.fn("users.backfill.assignMascots")(function* ({ cursor, dry }) {
    const writer = yield* DatabaseWriter;
    const page = yield* (yield* DatabaseReader)
      .table("users")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PAGE_SIZE })
      .pipe(Effect.orDie);
    const waiting = Arr.filter(page.page, (user) => user.mascot === undefined);
    if (!dry) {
      yield* Effect.forEach(
        waiting,
        (user) =>
          writer
            .table("users")
            .replace(user._id, {
              ...Struct.omit(user, ["_id", "_creationTime"]),
              mascot: accountMascot(user.authId),
            })
            .pipe(Effect.orDie),
        { discard: true }
      );
    }
    return {
      assigned: dry ? 0 : waiting.length,
      next: page.isDone ? null : page.continueCursor,
      waiting: waiting.length,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(assignMascots),
  GroupImpl.finalize
);
