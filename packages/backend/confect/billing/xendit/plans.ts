import {
  XENDIT_ORIGIN,
  XenditRequestFailed,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import {
  XenditPlan,
  XenditPlanRequest,
} from "@repo/backend/confect/billing/xendit/contract";
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

/**
 * Opens a recurring plan on a saved payment token. Xendit charges it on the
 * schedule's anchor and every period after, and posts each cycle by webhook.
 */
export const createPlan = Effect.fn("billing.xendit.createPlan")(function* (
  body: XenditPlanRequest
) {
  const request = yield* HttpClientRequest.schemaBodyJson(XenditPlanRequest)(
    HttpClientRequest.post(`${XENDIT_ORIGIN}/recurring/plans`).pipe(
      HttpClientRequest.setHeader("api-version", RECURRING_API_VERSION)
    ),
    body
  ).pipe(
    Effect.mapError(
      () =>
        new XenditRequestFailed({
          status: 0,
          errorCode: "REQUEST_NOT_ENCODABLE",
          message: "The plan does not match the Xendit contract.",
        })
    )
  );
  return yield* xenditRequest(request, XenditPlan);
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

/** The HTTP status Xendit answers for a recurring plan it does not hold. */
const HTTP_NOT_FOUND = 404;

/**
 * Turns a recurring plan off so Xendit charges no further cycle, unless it is
 * already off. Xendit answers 404 for a plan it does not hold, and such a plan has
 * no cycle left to charge, so it counts as off. The plan is read first, because
 * Xendit does not document what deactivating an inactive plan returns.
 */
export const ensurePlanInactive = Effect.fn(
  "billing.xendit.ensurePlanInactive"
)(function* (planId: string) {
  const plan = yield* getPlan(planId).pipe(
    Effect.catchTag("XenditRequestFailed", (error) =>
      error.status === HTTP_NOT_FOUND
        ? Effect.succeed(null)
        : Effect.fail(error)
    )
  );
  if (plan === null || plan.status === "INACTIVE") {
    return null;
  }
  yield* deactivatePlan(planId).pipe(
    Effect.catchTag("XenditRequestFailed", (error) =>
      error.status === HTTP_NOT_FOUND
        ? Effect.succeed(null)
        : Effect.fail(error)
    )
  );
  return null;
});
