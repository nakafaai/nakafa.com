import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  compactProgram,
  runProgram,
} from "@repo/backend/confect/contentRelease/compact";
import spec from "@repo/backend/confect/contentRelease/compact.spec";
import { Effect, Layer } from "effect";

const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.compact.page")(function* () {
    return yield* compactProgram();
  })
);
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("contentRelease.compact.run")(function* () {
    return yield* runProgram();
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  Layer.provide(run),
  GroupImpl.finalize
);
