import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { allocateUsername } from "@repo/backend/confect/users/allocation";
import spec from "@repo/backend/confect/users/migration.spec";
import { Array as Arr, Effect, Layer } from "effect";

/**
 * Accounts one call reads. Each one that waits takes at most
 * `MAX_ALLOCATION_TRIES` index reads and one write, however many accounts share
 * its name, so a call stays far below the transaction limits and ends well
 * inside the time a mutation may run.
 */
const PAGE_SIZE = 50;

/**
 * Gives a username to each live account of one page that holds none. The
 * accounts take their names one after another, so each one sees the usernames
 * the accounts before it just took.
 */
const allocateUsernames = FunctionImpl.make(
  databaseSchema,
  spec,
  "allocateUsernames",
  Effect.fn("users.migration.allocateUsernames")(function* ({ cursor }) {
    const writer = yield* DatabaseWriter;
    const page = yield* (yield* DatabaseReader)
      .table("users")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PAGE_SIZE })
      .pipe(Effect.orDie);
    const waiting = Arr.filter(
      page.page,
      (user) => user.username === undefined && user.deletedAt === undefined
    );
    yield* Effect.forEach(
      waiting,
      (user) =>
        allocateUsername(user.name).pipe(
          Effect.flatMap((username) =>
            writer.table("users").patch(user._id, { username })
          ),
          Effect.orDie
        ),
      { discard: true }
    );
    return {
      allocated: waiting.length,
      next: page.isDone ? null : page.continueCursor,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(allocateUsernames),
  GroupImpl.finalize
);
