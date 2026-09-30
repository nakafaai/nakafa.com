import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  backfillPage,
  backfillRun,
} from "@repo/backend/confect/contentRelease/artifact/backfill";
import spec from "@repo/backend/confect/contentRelease/artifact/backfill.spec";
import { Effect, Layer } from "effect";

/** Migrates one bounded page of artifact bodies into artifact facts. */
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.artifact.backfill.page")(function* (args) {
    return yield* backfillPage(args.cursor);
  })
);
/** Runs bounded artifact facts backfill pages from one cursor. */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("contentRelease.artifact.backfill.run")(function* (args) {
    return yield* backfillRun(args.cursor);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  Layer.provide(run),
  GroupImpl.finalize
);
