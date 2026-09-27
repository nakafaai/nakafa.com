import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  readSectionAttemptPage,
  readSetAttemptPage,
} from "@repo/backend/confect/tryouts/attemptPage/impl";
import spec from "@repo/backend/confect/tryouts/queries/attemptPage.spec";
import { Effect, Layer } from "effect";

const getSet = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSet",
  Effect.fn("tryouts.queries.attemptPage.getSet")(function* (args) {
    return yield* readSetAttemptPage(args.request);
  })
);
const getSection = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSection",
  Effect.fn("tryouts.queries.attemptPage.getSection")(function* (args) {
    return yield* readSectionAttemptPage(args.request);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getSet),
  Layer.provide(getSection),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
