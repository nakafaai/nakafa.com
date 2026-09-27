import { FunctionSpec, GroupSpec } from "@confect/core";
import { ProductAnalyticsCaptureErrorWire } from "@repo/backend/confect/analytics/capture.spec";
import { ConsentPersistenceErrorWire } from "@repo/backend/confect/consents/schema";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  TryoutStartErrorWire,
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
        TryoutAuthFailure,
        TryoutStartErrorWire,
        ConsentPersistenceErrorWire,
        ProductAnalyticsCaptureErrorWire,
      ]),
  })
);
