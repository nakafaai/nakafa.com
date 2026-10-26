import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  XenditPlanError,
  xenditPlanErrorCode,
} from "@repo/backend/confect/billing/spec";
import { createPlan } from "@repo/backend/confect/billing/xendit/plans";
import {
  planRequest,
  readRenewal,
  recordRenewal,
} from "@repo/backend/confect/billing/xendit/renewal";
import spec from "@repo/backend/confect/billing/xendit/renewal.spec";
import { Duration, Effect, Layer, Schedule } from "effect";

/** How often Xendit is asked again to open a plan before the failure is logged for an operator. */
const OPEN_RETRIES = 4;

const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("billing.xendit.renewal.readQuery")(function* ({ subscriptionId }) {
    return yield* readRenewal(subscriptionId);
  })
);

const record = FunctionImpl.make(
  databaseSchema,
  spec,
  "record",
  Effect.fn("billing.xendit.renewal.recordMutation")(function* ({
    planId,
    subscriptionId,
  }) {
    return yield* recordRenewal(subscriptionId, planId);
  })
);

/**
 * Opens the plan of a subscription whose first month is paid, asking Xendit
 * again with a growing pause when it does not answer or fails on its side, and
 * names it on the subscription.
 * A plan that would not open is logged for an operator: the paid month still
 * runs, and nothing renews it.
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("billing.xendit.renewal.open")(function* ({
    locale,
    subscriptionId,
  }) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const renewal = yield* runQuery(refs.internal.billing.xendit.renewal.read, {
      subscriptionId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (renewal === null) {
      return null;
    }
    const plan = yield* createPlan(
      planRequest({ locale, referenceId: subscriptionId, renewal })
    ).pipe(
      Effect.scoped,
      // Only a failure Xendit may not repeat is asked again; a refusal of the request stays a refusal.
      Effect.retry({
        schedule: Schedule.exponential(Duration.seconds(2)),
        times: OPEN_RETRIES,
        while: (error) =>
          error._tag === "XenditRequestFailed" &&
          (error.status === 0 || error.status >= 500),
      }),
      Effect.tapError((cause) =>
        Effect.logError("A paid Xendit plan did not open", {
          cause,
          subscriptionId,
        })
      ),
      Effect.mapError(
        (cause) =>
          new XenditPlanError({
            code: xenditPlanErrorCode,
            cause,
            message: "Failed to open a Xendit recurring plan.",
          })
      )
    );
    return yield* runMutation(refs.internal.billing.xendit.renewal.record, {
      planId: plan.id,
      subscriptionId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  Layer.provide(record),
  Layer.provide(open),
  GroupImpl.finalize
);
