import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import {
  XenditRefundError,
  xenditRefundErrorCode,
} from "@repo/backend/confect/billing/spec";
import spec from "@repo/backend/confect/billing/topup.spec";
import { createRefund } from "@repo/backend/confect/billing/xendit/refunds";
import { Effect, Layer } from "effect";

const refundWithoutPro = FunctionImpl.make(
  databaseSchema,
  spec,
  "refundWithoutPro",
  Effect.fn("billing.topup.impl.refundWithoutPro")(function* ({
    currency,
    orderId,
    rail,
    refundableAmount,
  }) {
    if (rail === "polar") {
      yield* polarGateway.refundOrder({ orderId, refundableAmount });
      return null;
    }
    yield* createRefund({
      amount: refundableAmount,
      currency,
      payment_id: orderId,
      reason: "CANCELLATION",
      reference_id: `pack-${orderId}`,
    }).pipe(
      Effect.scoped,
      Effect.tapError((cause) =>
        Effect.logError("A pack paid without Pro is still not refunded", {
          cause,
          orderId,
        })
      ),
      Effect.mapError(
        (cause) =>
          new XenditRefundError({
            code: xenditRefundErrorCode,
            cause,
            message: "Failed to refund a payment in Xendit.",
          })
      )
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(refundWithoutPro),
  GroupImpl.finalize
);
