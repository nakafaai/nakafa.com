import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { invoiceSessionRequest } from "@repo/backend/confect/billing/xendit/invoice";
import spec from "@repo/backend/confect/billing/xendit/invoice.spec";
import { createSession } from "@repo/backend/confect/billing/xendit/sessions";
import { Clock, DateTime, Effect, Layer } from "effect";

/** A Xendit call that failed is logged with its message alone, and the invoice keeps no link, so the next request to pay asks again. */
function logFailure(error: { readonly message: string }) {
  return Effect.logError("Xendit invoice session failed", {
    message: error.message,
  }).pipe(Effect.as(null));
}

/** Opens the hosted payment of one open invoice that holds no link yet, and records it. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("billing.xendit.invoice.open")(
    function* ({ invoiceId, offer }) {
      const { runQuery } = yield* QueryRunner;
      const { runMutation } = yield* MutationRunner;
      const invoice = yield* runQuery(
        refs.internal.billing.xendit.invoice.payable,
        { invoiceId }
      ).pipe(Effect.orDie);
      if (invoice === null) {
        return null;
      }
      const session = yield* createSession(invoiceSessionRequest(invoice));
      const url = session.payment_link_url ?? null;
      if (url === null) {
        return yield* logFailure({
          message: `Session ${session.payment_session_id} has no payment link.`,
        });
      }
      yield* runMutation(refs.internal.billing.xendit.invoice.record, {
        accountId: invoice.accountId,
        expiresAt: DateTime.toEpochMillis(session.expires_at),
        invoiceId,
        offer,
        sessionId: session.payment_session_id,
        url,
      }).pipe(Effect.orDie);
      return null;
    },
    Effect.scoped,
    Effect.catchTags({
      ConfigError: logFailure,
      XenditDecodeFailed: logFailure,
      XenditRequestFailed: logFailure,
    })
  )
);

/** The invoice a hosted payment pays, while it is open and holds no link: an invoice that is paid, void or linked needs none. */
const payable = FunctionImpl.make(
  databaseSchema,
  spec,
  "payable",
  Effect.fn("billing.xendit.invoice.payable")(function* ({ invoiceId }) {
    const invoice = yield* (yield* DatabaseReader)
      .table("billingInvoices")
      .get(invoiceId)
      .pipe(Effect.orDie);
    if (invoice.status !== "open" || invoice.paymentLink !== null) {
      return null;
    }
    return {
      accountId: invoice.accountId,
      dueAt: invoice.dueAt,
      number: invoice.number,
      total: invoice.total,
    };
  })
);

/** Stores the session as the invoice's open checkout and its payment link, so the billing page shows Pay. */
const record = FunctionImpl.make(
  databaseSchema,
  spec,
  "record",
  Effect.fn("billing.xendit.invoice.record")(function* (args) {
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("billingCheckouts")
      .insert({
        accountId: args.accountId,
        offer: args.offer,
        rail: "xendit",
        sessionId: args.sessionId,
        url: args.url,
        status: "open",
        openedAt: yield* Clock.currentTimeMillis,
        expiresAt: args.expiresAt,
        locale: "id",
        invoiceId: args.invoiceId,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("billingInvoices")
      .patch(args.invoiceId, { paymentLink: args.url })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(payable),
  Layer.provide(record),
  GroupImpl.finalize
);
