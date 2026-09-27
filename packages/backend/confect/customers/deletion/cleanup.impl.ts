import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  cleanupDeletedUserAnalytics,
  cleanupDeletedUserAuth,
  cleanupDeletedUserCustomer,
  cleanupDeletedUserData,
} from "@repo/backend/confect/customers/deletion/cleanup";
import spec from "@repo/backend/confect/customers/deletion/cleanup.spec";
import { Layer } from "effect";
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "cleanupDeletedUserAuth",
      cleanupDeletedUserAuth
    )
  ),
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "cleanupDeletedUserAnalytics",
      cleanupDeletedUserAnalytics
    )
  ),
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "cleanupDeletedUserCustomer",
      cleanupDeletedUserCustomer
    )
  ),
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "cleanupDeletedUserData",
      cleanupDeletedUserData
    )
  ),
  GroupImpl.finalize
);
