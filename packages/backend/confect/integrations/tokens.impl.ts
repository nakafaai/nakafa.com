import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  checkAccessToken,
  issueAccessToken,
  sweepTokens,
} from "@repo/backend/confect/integrations/token";
import spec from "@repo/backend/confect/integrations/tokens.spec";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "issue", issueAccessToken)),
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "check", checkAccessToken)),
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "sweep", sweepTokens)),
  GroupImpl.finalize
);
