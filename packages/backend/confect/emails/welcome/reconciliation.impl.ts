import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { reconcileWelcomeIntentLifecycleProgram } from "@repo/backend/confect/emails/welcome/reconciliation";
import spec from "@repo/backend/confect/emails/welcome/reconciliation.spec";
import { Effect, Layer } from "effect";

const reconcileWelcomeIntentLifecycle = FunctionImpl.make(
  databaseSchema,
  spec,
  "reconcileWelcomeIntentLifecycle",
  Effect.fn("emails.welcome.reconciliation.reconcileWelcomeIntentLifecycle")(
    function* ({ cursor, phase }) {
      const ctx = yield* MutationCtxService;
      return yield* reconcileWelcomeIntentLifecycleProgram(ctx, phase, cursor);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reconcileWelcomeIntentLifecycle),
  GroupImpl.finalize
);
