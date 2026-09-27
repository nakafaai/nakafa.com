import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { headPageProgram } from "@repo/backend/confect/contentRelease/heads";
import spec from "@repo/backend/confect/contentRelease/heads.spec";
import { Effect, Layer } from "effect";

/** Decodes one bounded active-head request into the exact shared contract. */
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.heads.page")(function* (args) {
    return yield* headPageProgram(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  GroupImpl.finalize
);
