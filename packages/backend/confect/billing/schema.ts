import { Id } from "@repo/backend/confect/_generated/id";
import {
  BillingCurrency,
  BillingOfferKey,
} from "@repo/backend/confect/billing/catalog";
import { Space } from "@repo/backend/confect/space";
import { userPlanValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";

/** The rail an account pays through. An account keeps the rail it was made with. */
export const BillingRail = Schema.Literals(["polar", "xendit"]);
export type BillingRail = typeof BillingRail.Type;

/** An ISO 3166-1 alpha-2 country code in uppercase. */
export const BillingCountry = Schema.String.check(
  Schema.isPattern(/^[A-Z]{2}$/u)
);
export type BillingCountry = typeof BillingCountry.Type;

/** The Xendit channels a recurring Pro or School subscription can be linked through. */
const XenditChannel = Schema.Literals([
  "CARDS",
  "DANA",
  "GOPAY_RECURRING",
  "OVO",
  "SHOPEEPAY",
]);

/** A payer. The owner is the person or the school, never both. */
export const billingAccountValidator = Schema.Struct({
  owner: Space,
  rail: BillingRail,
  country: BillingCountry,
  currency: BillingCurrency,
  /** The customer ID the rail knows this payer by, once the rail has created one. */
  providerCustomerId: Schema.NullOr(Schema.String),
});

/** Where a recurring subscription lives at its provider. Each rail names its own references. */
export const billingProviderValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("polar"),
    subscriptionId: Schema.String,
    productId: Schema.String,
    priceId: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("xendit"),
    planId: Schema.String,
    tokenId: Schema.NullOr(Schema.String),
    channel: XenditChannel,
  }),
]).pipe(Schema.toTaggedUnion("kind"));

export const billingSubscriptionStatusValidator = Schema.Literals([
  "pending",
  "active",
  "pastDue",
  "canceled",
  "ended",
]);

/** A recurring subscription. Quantity counts seats, one for a Pro consumer. */
export const billingSubscriptionValidator = Schema.Struct({
  accountId: Id("billingAccounts"),
  /** The catalog offer this subscription bills. */
  offer: BillingOfferKey,
  quantity: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  status: billingSubscriptionStatusValidator,
  currentPeriodStart: Schema.Finite,
  currentPeriodEnd: Schema.NullOr(Schema.Finite),
  cancelAtPeriodEnd: Schema.Boolean,
  provider: billingProviderValidator,
  /** The provider's own update time. A webhook older than this never overwrites the row. */
  providerUpdatedAt: Schema.Finite,
});

/** A subscription as the billing settings show it: its offer, its state, its paid period, and the rail that bills it. */
export const billingSubscriptionSummaryValidator = Schema.Struct({
  offer: BillingOfferKey,
  status: billingSubscriptionStatusValidator,
  currentPeriodStart: Schema.Finite,
  currentPeriodEnd: Schema.NullOr(Schema.Finite),
  cancelAtPeriodEnd: Schema.Boolean,
  rail: BillingRail,
});

/** What the billing settings show for a viewer: the plan, the subscription that bills it, and the Nina credits. */
export const billingOverviewValidator = Schema.Struct({
  plan: userPlanValidator,
  subscription: Schema.NullOr(billingSubscriptionSummaryValidator),
  credits: Schema.Struct({
    /** The credits the plan grants each reset period. */
    allowance: Schema.Finite,
    /** The credits the viewer holds in the current reset period. */
    balance: Schema.Finite,
    /** The moment the balance refills next, in epoch milliseconds. */
    resetAt: Schema.Finite,
  }),
});

/** The fields every payment shares, whatever it pays for. `amount` is in the currency's minor unit. */
const billingPaymentFields = {
  accountId: Id("billingAccounts"),
  status: Schema.Literals(["succeeded", "failed", "refunded"]),
  amount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: BillingCurrency,
  rail: BillingRail,
  providerPaymentId: Schema.String,
  /** The provider's own update time. A payment update older than this never overwrites the row. */
  providerUpdatedAt: Schema.Finite,
  method: Schema.String,
  paidAt: Schema.Finite,
};

/** One payment that arrived. Each kind names the one thing it pays for, so no kind holds a reference it lacks. */
export const billingPaymentValidator = Schema.Union([
  Schema.Struct({
    ...billingPaymentFields,
    kind: Schema.Literal("cycle"),
    subscriptionId: Id("billingSubscriptions"),
  }),
  Schema.Struct({
    ...billingPaymentFields,
    kind: Schema.Literal("pass"),
  }),
  Schema.Struct({
    ...billingPaymentFields,
    kind: Schema.Literal("invoice"),
    invoiceId: Id("billingInvoices"),
  }),
]).pipe(Schema.toTaggedUnion("kind"));

/** One line of an invoice. `amount` is `quantity` times `unitAmount`, in minor units. */
const billingInvoiceLineValidator = Schema.Struct({
  description: Schema.String,
  quantity: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  unitAmount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  amount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** A school or Enterprise invoice, numbered `NKF-YYYY-NNNNNN` in issue order. */
export const billingInvoiceValidator = Schema.Struct({
  accountId: Id("billingAccounts"),
  number: Schema.String.check(Schema.isPattern(/^NKF-\d{4}-\d{6}$/u)),
  status: Schema.Literals(["draft", "open", "paid", "void"]),
  currency: BillingCurrency,
  lines: Schema.NonEmptyArray(billingInvoiceLineValidator),
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  periodStart: Schema.Finite,
  periodEnd: Schema.Finite,
  dueAt: Schema.Finite,
  paymentLink: Schema.NullOr(Schema.String),
  /** The buyer's tax number, when the buyer gave one. Tax invoices are issued outside Xendit. */
  buyerTaxId: Schema.NullOr(Schema.String),
});

/** Where a grant's time came from: a subscription cycle, a pass, an invoice, or a signed contract. */
const billingGrantSourceValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("subscription"),
    subscriptionId: Id("billingSubscriptions"),
  }),
  Schema.Struct({
    kind: Schema.Literal("pass"),
    paymentId: Id("billingPayments"),
  }),
  Schema.Struct({
    kind: Schema.Literal("invoice"),
    invoiceId: Id("billingInvoices"),
  }),
  Schema.Struct({
    kind: Schema.Literal("contract"),
    contractId: Schema.String,
  }),
]).pipe(Schema.toTaggedUnion("kind"));

/** Which units of a school a school grant covers. */
const schoolGrantScopeValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("tenant") }),
  Schema.Struct({ kind: Schema.Literal("unit"), unitId: Id("tenantUnits") }),
]).pipe(Schema.toTaggedUnion("kind"));

/** A time-bounded right to Pro for one person. `users.plan` is projected from these. */
const proBillingGrantValidator = Schema.Struct({
  product: Schema.Literal("pro"),
  userId: Id("users"),
  source: billingGrantSourceValidator,
  validFrom: Schema.Finite,
  validTo: Schema.Finite,
});

/**
 * A time-bounded right to Pro for the enrolled students of a school or one unit of it.
 * `seats` counts the students the grant covers. `ninaSeats` counts the students whose
 * shared Nina pool the school draws on: a contract grant has none, so its AI cost
 * stays where its price was set.
 */
const schoolBillingGrantValidator = Schema.Struct({
  product: Schema.Literal("school"),
  tenantId: Id("tenants"),
  scope: schoolGrantScopeValidator,
  seats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  ninaSeats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  source: billingGrantSourceValidator,
  validFrom: Schema.Finite,
  validTo: Schema.Finite,
});

export const billingGrantValidator = Schema.Union([
  proBillingGrantValidator,
  schoolBillingGrantValidator,
]).pipe(Schema.toTaggedUnion("product"));

/** One webhook as received. `key` is unique per rail, so a redelivery is recognized. */
export const billingEventValidator = Schema.Struct({
  rail: BillingRail,
  key: Schema.String,
  type: Schema.String,
  /** The provider's own timestamp for the object the event describes. */
  providerTime: Schema.Finite,
  /** The body exactly as the provider sent it. */
  payload: Schema.String,
  receivedAt: Schema.Finite,
  processedAt: Schema.NullOr(Schema.Finite),
});

/** The last invoice number issued in one year. */
export const billingCounterValidator = Schema.Struct({
  year: Schema.Int,
  next: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});

/** One webhook delivery as its route receives it, before the inbox stores it. */
export const billingEventDeliveryValidator = Schema.Struct({
  rail: BillingRail,
  key: Schema.String,
  type: Schema.String,
  providerTime: Schema.Finite,
  payload: Schema.String,
});
export type BillingEventDelivery = typeof billingEventDeliveryValidator.Type;

/** What applying one stored delivery did: it is processed, or it names a Polar customer Nakafa must link before it can apply. */
export const billingEventAppliedValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("processed") }),
  Schema.Struct({
    kind: Schema.Literal("unknownCustomer"),
    customerId: Schema.String,
  }),
]).pipe(Schema.toTaggedUnion("kind"));

/** One unprocessed Polar delivery the sweep reads, with the fields it logs. */
export const unprocessedBillingEventValidator = Schema.Struct({
  eventId: Id("billingEvents"),
  key: Schema.String,
  receivedAt: Schema.Finite,
  type: Schema.String,
});
