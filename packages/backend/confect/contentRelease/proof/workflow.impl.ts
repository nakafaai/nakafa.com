import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { verifyRelease } from "@repo/backend/confect/contentRelease/proof/workflow";
import spec from "@repo/backend/confect/contentRelease/proof/workflow.spec";
import { Layer } from "effect";
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "verifyRelease", verifyRelease)
  ),
  GroupImpl.finalize
);
