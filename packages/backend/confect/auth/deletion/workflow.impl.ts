import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { finalizeAccountDeletion } from "@repo/backend/confect/auth/deletion/finalize";
import { launchDeletedUserCleanupProgram } from "@repo/backend/confect/auth/deletion/workflow";
import spec from "@repo/backend/confect/auth/deletion/workflow.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const finalize = FunctionImpl.make(
  databaseSchema,
  spec,
  "finalize",
  Effect.fn("auth.deletion.workflow.finalize")(function* (args) {
    yield* finalizeAccountDeletion(args.userId);
    return null;
  })
);
const launch = FunctionImpl.make(
  databaseSchema,
  spec,
  "launch",
  Effect.fn("auth.deletion.workflow.launch")(function* (args) {
    yield* launchDeletedUserCleanupProgram(args.userId);
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(finalize),
  Layer.provide(launch),
  Layer.provide(atomic),
  GroupImpl.finalize
);
