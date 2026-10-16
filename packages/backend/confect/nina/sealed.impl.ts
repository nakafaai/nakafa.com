import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import spec from "@repo/backend/confect/nina/sealed.spec";
import { Effect, Layer } from "effect";

/** One page of a thread's messages, opened for the owner of the thread (`readThread`). */
const thread = FunctionImpl.make(
  schema,
  spec,
  "thread",
  Effect.fn("nina.sealed.threadPage")(function* (args) {
    const ctx = yield* QueryCtx;
    return yield* readThread(ctx, args);
  })
);

/** One message of a thread, opened for its owner, or null (`readMessage`). */
const message = FunctionImpl.make(
  schema,
  spec,
  "message",
  Effect.fn("nina.sealed.messageRow")(function* ({ messageId, owner }) {
    const ctx = yield* QueryCtx;
    return yield* readMessage(ctx, owner, messageId);
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(thread),
  Layer.provide(message),
  GroupImpl.finalize
);
