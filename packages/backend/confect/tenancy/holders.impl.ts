import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  CLAIM_PAGE_SIZE,
  scheduleRun,
} from "@repo/backend/confect/tenancy/claims";
import spec from "@repo/backend/confect/tenancy/holders.spec";
import { Duration, Effect, Layer } from "effect";

/**
 * Schedules the claim run of each account that holds an address, a page at a
 * time, then the next page, so no number of accounts is assumed. An account
 * that is being deleted gets a run too: `tenancy/claims:run` is the one place
 * that decides whether an account may claim, and it claims nothing for that
 * account.
 */
const schedule = FunctionImpl.make(
  databaseSchema,
  spec,
  "schedule",
  Effect.fn("tenancy.holders.schedule")(function* ({ cursor, email }) {
    const page = yield* (yield* DatabaseReader)
      .table("users")
      .index("by_email", (query) => query.eq("email", email))
      .paginate({ cursor, numItems: CLAIM_PAGE_SIZE })
      .pipe(Effect.orDie);
    yield* Effect.forEach(page.page, (user) => scheduleRun(user._id), {
      discard: true,
    });
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.tenancy.holders.schedule,
        { cursor: page.continueCursor, email }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(schedule),
  GroupImpl.finalize
);
