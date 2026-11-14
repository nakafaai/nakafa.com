import {
  LocalConvex,
  localConvexLayer,
  readRows,
} from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { encodeJsonText } from "@repo/utilities/json";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Option,
  Schema,
} from "effect";

/** What a learner seeds: a one-month pass, or the monthly plan with its first month paid. */
const XenditPurchase = Schema.Literals(["pass", "plan"]);

/** The answers of the checkout's prepare step and of the event inbox. */
const Prepared = Schema.Struct({ accountId: Schema.String });
const Recorded = Schema.Struct({ eventId: Schema.String });

/**
 * One Xendit webhook body for an event of one pay session, as Xendit posts it. Its key names the session, as
 * Xendit's own delivery ID names one delivery, so the inbox takes two seeds as two deliveries however close in
 * time they run, and a step repeated for the same session as the retry it is.
 */
function deliveryOf(
  event: string,
  data: object,
  sessionId: string,
  now: number
) {
  return {
    key: `acceptance:${event}:${sessionId}`,
    payload: encodeJsonText({
      business_id: "acceptance",
      created: DateTime.formatIso(DateTime.makeUnsafe(now)),
      data,
      event,
    }),
    providerTime: now,
    rail: "xendit",
    type: event,
  };
}

/**
 * The Xendit webhook that completes one pay session. A session that saved the
 * buyer's channel, as the monthly plan's does, also carries its payment token.
 */
function deliveryOfPaid(sessionId: string, now: number, saved: boolean) {
  return deliveryOf(
    "payment_session.completed",
    {
      payment_id: `py_${sessionId}`,
      payment_session_id: sessionId,
      ...(saved ? { payment_token_id: `pt_${sessionId}` } : {}),
      reference_id: sessionId,
      session_type: "PAY",
      status: "COMPLETED",
    },
    sessionId,
    now
  );
}

/**
 * Gives a learner of the running local acceptance backend a Xendit purchase the
 * way production records one: the checkout's own prepare and admit steps open
 * the Xendit account and the checkout, and the event inbox applies the webhook
 * Xendit would post once the learner paid. The monthly plan's recurring plan
 * then fails to open against the inert Xendit key, which leaves the paid month
 * to show, so a browser test sees a pass or a Xendit plan without a provider.
 */
export const seedXendit = Effect.fn("contentAcceptance.seedXendit")(function* (
  userId: string,
  purchase: typeof XenditPurchase.Type
) {
  const convex = yield* LocalConvex;
  const run = (operation: string, path: string, args: object) =>
    convex.run(operation, { args, path });
  const now = yield* Clock.currentTimeMillis;
  const offer = purchase === "pass" ? "pro.pass.1" : "pro.monthly";
  // A pay session of its own: browser tests seed in parallel, so two seeds can start in the same millisecond.
  const sessionId = `ps_acceptance_${yield* randomUuid}`;
  const { accountId } = yield* run(
    "xendit prepare",
    "billing/xendit/checkout:prepare",
    { offer, userId }
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Prepared)));
  yield* run("xendit admit", "billing/xendit/checkout:admit", {
    accountId,
    event: {
      name: "checkout started",
      properties: {
        checkout_locale: "en",
        customer_ip_available: false,
        locale: "en",
        product_count: 1,
        product_id: offer,
        rail: "xendit",
      },
    },
    locale: "en",
    offer,
    session: {
      expiresAt: now + Duration.toMillis(Duration.minutes(30)),
      sessionId,
      url: `https://checkout-staging.xendit.co/sessions/${sessionId}`,
    },
    userId,
  });
  const { eventId } = yield* run(
    "xendit event",
    "billing/events:record",
    deliveryOfPaid(sessionId, now, purchase === "plan")
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Recorded)));
  yield* run("xendit apply", "billing/events:apply", { eventId });
});

/** The usage of the xendit mode: the learner's app user ID, then the purchase. */
const USAGE = "xendit <user-id> <pass|plan>";
const XenditArguments = Schema.Tuple([Schema.String, XenditPurchase]);

/**
 * The xendit mode of the acceptance command line: gives the learner it names
 * the purchase it names, as of the moment the command runs.
 */
export const xenditMode = {
  mode: "xendit",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runXendit")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [userId, purchase] = yield* decodeModeArguments(
      USAGE,
      XenditArguments,
      args
    );
    yield* seedXendit(userId, purchase).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;

/** One school invoice of the local runtime, as much of it as the mode reads. */
const InvoiceRow = Schema.Struct({
  _id: Schema.String,
  accountId: Schema.String,
  dueAt: Schema.Finite,
  number: Schema.String,
});

/** The most invoices the mode reads to find one: every school a shared runtime holds. */
const INVOICE_LIMIT = 1000;

/** What happens to a school invoice on Xendit: its hosted payment opens, or the school pays it. */
const InvoiceStep = Schema.Literals(["open", "paid"]);

/**
 * Takes one school invoice of the running local acceptance backend through
 * Xendit's hosted payment the way production records it. `open` stores the
 * session Xendit answers with as the invoice's checkout and payment link, which
 * the inert Xendit key cannot ask for, so the billing page shows Pay. `paid`
 * has the event inbox apply the webhook Xendit posts once the school paid on
 * that page, so the invoice is paid and its School grant written. The session
 * takes its ID from the invoice number, so both steps name the same one.
 */
export const payInvoice = Effect.fn("contentAcceptance.payInvoice")(function* (
  number: string,
  step: typeof InvoiceStep.Type
) {
  const convex = yield* LocalConvex;
  const run = (operation: string, path: string, args: object) =>
    convex.run(operation, { args, path });
  const now = yield* Clock.currentTimeMillis;
  const sessionId = `ps_acceptance_${number}`;
  if (step === "paid") {
    const { eventId } = yield* run(
      "xendit event",
      "billing/events:record",
      deliveryOfPaid(sessionId, now, false)
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Recorded)));
    yield* run("xendit apply", "billing/events:apply", { eventId });
    return;
  }
  const invoices = yield* readRows(
    convex.run,
    "billingInvoices",
    InvoiceRow,
    INVOICE_LIMIT
  );
  const invoice = Arr.findFirst(invoices, (row) => row.number === number);
  if (Option.isNone(invoice)) {
    return yield* acceptanceRuntimeError(
      `The local runtime holds no invoice ${number}.`
    );
  }
  yield* run("xendit invoice session", "billing/xendit/invoice:record", {
    accountId: invoice.value.accountId,
    expiresAt: invoice.value.dueAt,
    invoiceId: invoice.value._id,
    sessionId,
    url: `https://checkout-staging.xendit.co/sessions/${sessionId}`,
  });
});

/** The usage of the invoice mode: the invoice number, then the step on Xendit. */
const INVOICE_USAGE = "invoice <invoice-number> <open|paid>";
const InvoiceArguments = Schema.Tuple([Schema.String, InvoiceStep]);

/**
 * The invoice mode of the acceptance command line: opens the hosted payment of
 * the school invoice it names, or pays it, as of the moment the command runs.
 */
export const invoiceMode = {
  mode: "invoice",
  usage: INVOICE_USAGE,
  run: Effect.fn("contentAcceptance.runInvoice")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [number, step] = yield* decodeModeArguments(
      INVOICE_USAGE,
      InvoiceArguments,
      args
    );
    yield* payInvoice(number, step).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;
