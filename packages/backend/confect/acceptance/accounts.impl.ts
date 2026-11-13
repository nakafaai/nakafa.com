import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  seedAccountProfile,
  seedPasswordAccount,
} from "@repo/backend/confect/acceptance/account";
import spec from "@repo/backend/confect/acceptance/accounts.spec";
import { Layer } from "effect";

/** Implements the acceptance seed of `accounts.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "create", seedPasswordAccount)
  ),
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "profile", seedAccountProfile)
  ),
  GroupImpl.finalize
);
