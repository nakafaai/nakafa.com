import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import { readCaller } from "@repo/backend/confect/auth/caller";
import spec from "@repo/backend/confect/auth/caller.spec";
import { Effect, Layer } from "effect";

const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("auth.caller.query")(function* () {
    const caller = yield* readCaller(yield* QueryCtx);
    return { userId: caller.userId ?? null, appUser: caller.appUser };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
