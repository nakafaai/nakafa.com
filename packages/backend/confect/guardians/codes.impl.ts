import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  redeemCode,
  sendCode,
  sweepCodes,
} from "@repo/backend/confect/guardians/codes";
import spec from "@repo/backend/confect/guardians/codes.spec";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "send", sendCode)),
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "redeem", redeemCode)),
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "sweep", sweepCodes)),
  GroupImpl.finalize
);
