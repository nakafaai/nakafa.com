import { FunctionSpec, GroupSpec } from "@confect/core";
import { ProductAnalyticsCaptureError } from "@repo/backend/confect/analytics/capture.spec";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ConsentPersistenceError } from "@repo/backend/confect/consents/schema";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  TryoutStartError,
  tryoutPaywallSourceValidator,
} from "@repo/backend/confect/tryouts/start/spec";
import { Schema } from "effect";

/** Records one authenticated view of the try-out upgrade dialog. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "trackPaywallView",
    args: () => ({
      source: tryoutPaywallSourceValidator,
    }),
    returns: () => Schema.Null,
    error: () =>
      Schema.Union([
        AuthFailure,
        TryoutStartError,
        ConsentPersistenceError,
        ProductAnalyticsCaptureError,
      ]),
  }).middleware(Session)
);
