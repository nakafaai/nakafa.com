import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/billing/draw.spec";
import { drawInvoicePdf } from "@repo/pdf/invoice/draw";
import { Effect, Layer } from "effect";
import { Base64 } from "effect/encoding";

/** Draws one invoice as a PDF, whose bytes travel back as Base64. */
const invoice = FunctionImpl.make(
  databaseSchema,
  spec,
  "invoice",
  Effect.fn("billing.draw.invoice")(function* (input) {
    const bytes = yield* drawInvoicePdf(input).pipe(Effect.orDie);
    return Base64.encode(bytes);
  })
);

/** The drawing of a learner's invoices. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(invoice),
  GroupImpl.finalize
);
