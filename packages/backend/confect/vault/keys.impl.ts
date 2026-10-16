import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/vault/keys.spec";
import { rewrapKeys } from "@repo/backend/confect/vault/rewrap";
import { Effect, Layer } from "effect";

/** Keys one call moves: far below the transaction write limit. */
const PAGE_SIZE = 200;

const rewrap = FunctionImpl.make(
  schema,
  spec,
  "rewrap",
  Effect.fn("vault.keys.rewrapPage")(function* () {
    return yield* rewrapKeys(PAGE_SIZE).pipe(Effect.orDie);
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(rewrap),
  GroupImpl.finalize
);
