import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { deleteCurrentAccount } from "@repo/backend/confect/auth/deletion/request";
import spec from "@repo/backend/confect/auth/deletion.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "deleteAccount", deleteCurrentAccount)
  ),
  Layer.provide(session),
  Layer.provide(atomic),
  GroupImpl.finalize
);
