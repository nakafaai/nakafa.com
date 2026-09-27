import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { eraseConsentOverlap } from "@repo/backend/confect/analytics/erasure/workflow";
import spec from "@repo/backend/confect/analytics/erasure/workflow.spec";
import { Layer } from "effect";
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "eraseConsentOverlap",
      eraseConsentOverlap
    )
  ),
  GroupImpl.finalize
);
