import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { finalizeAccountDeletion } from "@repo/backend/confect/auth/deletion/finalize";
import { launchDeletedUserCleanupProgram } from "@repo/backend/confect/auth/deletion/workflow";
import spec from "@repo/backend/confect/auth/deletion/workflow.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const finalizeDeletedUserCleanup = FunctionImpl.make(
  databaseSchema,
  spec,
  "finalizeDeletedUserCleanup",
  Effect.fn("auth.deletion.workflow.finalizeDeletedUserCleanup")(
    function* (args) {
      yield* finalizeAccountDeletion(args.authId, args.expectedPreparation);
      return null;
    }
  )
);
const launchDeletedUserCleanup = FunctionImpl.make(
  databaseSchema,
  spec,
  "launchDeletedUserCleanup",
  Effect.fn("auth.deletion.workflow.launchDeletedUserCleanup")(
    function* (args) {
      yield* launchDeletedUserCleanupProgram(args.authId, args.userId);
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(finalizeDeletedUserCleanup),
  Layer.provide(launchDeletedUserCleanup),
  Layer.provide(atomic),
  GroupImpl.finalize
);
