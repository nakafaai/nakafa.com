import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { expireLot } from "@repo/backend/confect/credits/lots";
import spec from "@repo/backend/confect/credits/lots.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer } from "effect";

const expire = FunctionImpl.make(
  databaseSchema,
  spec,
  "expire",
  Effect.fn("credits.lots.impl.expire")(function* (args) {
    yield* expireLot(args.lotId, yield* Clock.currentTimeMillis);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(expire),
  Layer.provide(atomic),
  GroupImpl.finalize
);
