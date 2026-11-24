import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/tryouts/mutations/repin.spec";
import {
  repinSnapshotPage,
  runRepinSnapshot,
} from "@repo/backend/confect/tryouts/repin";
import { Effect, Layer } from "effect";

const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("tryouts.mutations.repin.page")(function* (args) {
    return yield* repinSnapshotPage(args);
  })
);
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("tryouts.mutations.repin.run")(function* (args) {
    return yield* runRepinSnapshot(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  Layer.provide(run),
  Layer.provide(atomic),
  GroupImpl.finalize
);
