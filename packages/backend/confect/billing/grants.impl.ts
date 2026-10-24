import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  projectSchoolPage,
  projectUserPlan,
} from "@repo/backend/confect/billing/grants";
import spec from "@repo/backend/confect/billing/grants.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer } from "effect";

const project = FunctionImpl.make(
  databaseSchema,
  spec,
  "project",
  Effect.fn("billing.grants.project")(function* (args) {
    yield* projectUserPlan(args.userId, yield* Clock.currentTimeMillis);
    return null;
  })
);

const projectSchool = FunctionImpl.make(
  databaseSchema,
  spec,
  "projectSchool",
  Effect.fn("billing.grants.projectSchool")(function* (args) {
    return yield* projectSchoolPage(
      args.tenantId,
      args.cursor,
      yield* Clock.currentTimeMillis
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(project),
  Layer.provide(projectSchool),
  Layer.provide(atomic),
  GroupImpl.finalize
);
