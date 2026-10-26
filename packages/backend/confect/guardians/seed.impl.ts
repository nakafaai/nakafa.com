import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { seedGuardianCode } from "@repo/backend/confect/guardians/seed";
import spec from "@repo/backend/confect/guardians/seed.spec";
import { Layer } from "effect";

/** Implements the acceptance seed of `seed.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "code", seedGuardianCode)
  ),
  GroupImpl.finalize
);
