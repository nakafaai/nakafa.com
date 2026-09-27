import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  onCreate,
  onDelete,
  onUpdate,
} from "@repo/backend/confect/auth/lifecycle";
import spec from "@repo/backend/confect/auth/lifecycle.spec";
import { Layer } from "effect";
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "onCreate", onCreate)),
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "onUpdate", onUpdate)),
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "onDelete", onDelete)),
  GroupImpl.finalize
);
