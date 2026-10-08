import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import spec from "@repo/backend/confect/customers/checkout/admission.spec";
import { admitCheckoutProgram } from "@repo/backend/confect/customers/checkout/impl";
import { checkoutSessionIoError } from "@repo/backend/confect/customers/checkout/spec";
import { Effect, flow, Layer } from "effect";

const admitCheckoutSession = FunctionImpl.make(
  databaseSchema,
  spec,
  "admitCheckoutSession",
  Effect.fn("customers.checkout.admission.admitCheckoutSession")(
    function* (args) {
      return yield* admitCheckoutProgram(
        () =>
          captureProductEvent({
            distinctId: args.userId,
            event: args.event,
            ...(args.timestamp === undefined
              ? {}
              : {
                  timestamp: new Date(args.timestamp),
                }),
          }),
        Effect.fn("customers.checkout.loadAdmissionUser")(
          function* () {
            return yield* (yield* DatabaseReader)
              .table("users")
              .get(args.userId)
              .pipe(
                Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
                Effect.orDie
              );
          },
          Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
        )
      );
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(admitCheckoutSession),
  GroupImpl.finalize
);
