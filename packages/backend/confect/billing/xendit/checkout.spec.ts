import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { productAnalyticsEventValidator } from "@repo/backend/confect/analytics/events";
import {
  checkoutAdmissionValidator,
  ProCheckoutOffer,
} from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * The Xendit account a learner's checkout pays through, with the hosted page of a
 * session for the same offer that is still open, or that the account is unavailable.
 */
const preparedCheckoutValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("open"),
    accountId: IdSchema("billingAccounts"),
    authId: Schema.String,
    email: Schema.String,
    name: Schema.String,
    providerCustomerId: Schema.NullOr(Schema.String),
    /** The page of an open session for the same offer, which the learner reopens instead of a second session. */
    openUrl: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("unavailable"),
  }),
]).pipe(Schema.toTaggedUnion("kind"));

/** The session Xendit opened: its ID, its page, when it closes unpaid, and the recurring plan a subscription session opened. */
const openedSessionValidator = Schema.Struct({
  sessionId: Schema.String,
  url: Schema.String,
  expiresAt: Schema.Finite,
  planId: Schema.NullOr(Schema.String),
});

/**
 * The internal steps of a Xendit checkout: prepare the learner's Xendit account,
 * then record the session Xendit opened once the account is admitted again.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "prepare",
      args: () => ({
        userId: IdSchema("users"),
        offer: ProCheckoutOffer,
      }),
      returns: () => preparedCheckoutValidator,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "admit",
      args: () => ({
        accountId: IdSchema("billingAccounts"),
        userId: IdSchema("users"),
        offer: ProCheckoutOffer,
        session: openedSessionValidator,
        event: productAnalyticsEventValidator,
      }),
      returns: () => checkoutAdmissionValidator,
    }).middleware(Atomic)
  );
