import {
  DatabaseReader,
  DatabaseWriter,
  MiddlewareImpl,
} from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { triggers } from "@repo/backend/confect/functions";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Effect, Layer } from "effect";

export default MiddlewareImpl.make(
  schema,
  Atomic,
  Effect.fn("database.atomic")(function* (effect) {
    const ctx = triggers.wrapDB(yield* MutationCtx);
    return yield* effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(MutationCtx, ctx),
          DatabaseReader.layer(schema, ctx.db),
          DatabaseWriter.layer(schema, ctx.db)
        )
      )
    );
  })
);
