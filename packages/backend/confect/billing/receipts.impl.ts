import { FunctionImpl, GroupImpl } from "@confect/server";
import billingPublic from "@repo/backend/confect/_generated/refs/billing";
import billingInternal from "@repo/backend/confect/_generated/refs/billing.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionRunner,
  DatabaseReader,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { paymentInvoice } from "@repo/backend/confect/billing/receipts";
import spec, {
  ReceiptUnavailable,
} from "@repo/backend/confect/billing/receipts.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { Effect, Layer, Option } from "effect";

/** The invoice of one succeeded Xendit payment of the learner, and nothing for any other payment. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("billing.receipts.read")(function* ({ locale, paymentId, userId }) {
    const reader = yield* DatabaseReader;
    const payment = yield* reader
      .table("billingPayments")
      .get(paymentId)
      .pipe(Effect.option);
    if (
      Option.isNone(payment) ||
      payment.value.rail !== "xendit" ||
      payment.value.status !== "succeeded"
    ) {
      return null;
    }
    const account = yield* reader
      .table("billingAccounts")
      .get(payment.value.accountId)
      .pipe(Effect.orDie);
    if (account.owner.kind !== "personal" || account.owner.userId !== userId) {
      return null;
    }
    const buyer = yield* reader.table("users").get(userId).pipe(Effect.orDie);
    return paymentInvoice(payment.value, buyer, locale);
  })
);

/** Draws one invoice in the Node runtime, as the file the browser saves. */
const drawn = Effect.fn("billing.receipts.drawn")(function* (
  invoice: typeof InvoiceInput.Type
) {
  const base64 = yield* (yield* ActionRunner)
    .runAction(billingInternal.draw.invoice, invoice)
    .pipe(Effect.orDie);
  return { base64, name: `nakafa-invoice-${invoice.number}.pdf` };
});

/** Draws the invoice of one of the viewer's payments. */
const download = FunctionImpl.make(
  databaseSchema,
  spec,
  "download",
  Effect.fn("billing.receipts.download")(function* ({ locale, paymentId }) {
    const { appUser } = yield* requireAuth();
    const invoice = yield* (yield* QueryRunner)
      .runQuery(billingInternal.receipts.read, {
        locale,
        paymentId,
        userId: appUser._id,
      })
      .pipe(Effect.orDie);
    if (invoice === null) {
      return yield* new ReceiptUnavailable({
        code: "BILLING_RECEIPT_UNAVAILABLE",
        message: "This payment has no invoice for the viewer.",
      });
    }
    return yield* drawn(invoice);
  })
);

/** Draws one invoice of a school, under the viewer's access to its billing. */
const school = FunctionImpl.make(
  databaseSchema,
  spec,
  "school",
  Effect.fn("billing.receipts.school")(function* ({ locale, number, slug }) {
    yield* requireAuth();
    const invoice = yield* (yield* QueryRunner)
      .runQuery(billingPublic.school.invoice, { locale, number, slug })
      .pipe(
        Effect.catchTags({
          NotMember: () =>
            Effect.fail(
              new AccessDenied({ action: "billing.view", reason: "role" })
            ),
          SchemaError: Effect.die,
        })
      );
    if (invoice === null) {
      return yield* new ReceiptUnavailable({
        code: "BILLING_RECEIPT_UNAVAILABLE",
        message: "This school holds no such invoice.",
      });
    }
    return yield* drawn(invoice);
  })
);

/** The invoices Nakafa issues. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  Layer.provide(download),
  Layer.provide(school),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
