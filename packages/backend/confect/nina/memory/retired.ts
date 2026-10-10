import { FunctionImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/nina/memory.spec";
import { Effect } from "effect";

// The four functions below answer browser tabs opened before October 2026,
// which still call the old settings card. They change nothing and report
// memory as off. They leave with the retired model key, and with them this
// module.

/** Reports memory as off, whoever asks. */
export const get = FunctionImpl.make(
  schema,
  spec,
  "get",
  Effect.fn("nina.memory.get")(() => Effect.succeed(null))
);

/** Changes nothing and answers with an empty list of facts. */
export const enable = FunctionImpl.make(
  schema,
  spec,
  "enable",
  Effect.fn("nina.memory.enable")(function* () {
    yield* requireAuth();
    return { facts: [] };
  })
);

/** Changes nothing. */
export const disable = FunctionImpl.make(
  schema,
  spec,
  "disable",
  Effect.fn("nina.memory.disable")(function* () {
    yield* requireAuth();
    return null;
  })
);

/** Changes nothing: a memory is forgotten on the Memory page. */
export const forget = FunctionImpl.make(
  schema,
  spec,
  "forget",
  Effect.fn("nina.memory.forget")(function* () {
    yield* requireAuth();
    return null;
  })
);
