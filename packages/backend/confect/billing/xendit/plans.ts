import {
  XENDIT_ORIGIN,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import { XenditPlan } from "@repo/backend/confect/billing/xendit/contract";
import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";

/** The Xendit API version every recurring-plan call names. */
const RECURRING_API_VERSION = "2026-01-01";

/** Reads one recurring plan as Xendit holds it. */
export const getPlan = Effect.fn("billing.xendit.getPlan")(function* (
  planId: string
) {
  return yield* xenditRequest(
    HttpClientRequest.get(
      `${XENDIT_ORIGIN}/recurring/plans/${encodeURIComponent(planId)}`
    ).pipe(HttpClientRequest.setHeader("api-version", RECURRING_API_VERSION)),
    XenditPlan
  );
});

/** Turns a recurring plan off, so Xendit charges no further cycle for it. */
export const deactivatePlan = Effect.fn("billing.xendit.deactivatePlan")(
  function* (planId: string) {
    return yield* xenditRequest(
      HttpClientRequest.post(
        `${XENDIT_ORIGIN}/recurring/plans/${encodeURIComponent(planId)}/deactivate`
      ).pipe(HttpClientRequest.setHeader("api-version", RECURRING_API_VERSION)),
      XenditPlan
    );
  }
);
