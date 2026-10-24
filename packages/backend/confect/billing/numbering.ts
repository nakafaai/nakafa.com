import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Effect, Option, Schema } from "effect";

/** The highest sequence a six-digit invoice number can carry. */
const MAX_INVOICE_SEQUENCE = 999_999;

/** A year's invoice numbers are used up, so the next invoice cannot take a number. */
export class InvoiceNumberExhausted extends Schema.TaggedError<InvoiceNumberExhausted>()(
  "InvoiceNumberExhausted",
  {
    year: Schema.Int,
    message: Schema.String,
  }
) {}

/** Formats one sequence as the invoice number `NKF-YYYY-NNNNNN` of its year. */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `NKF-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Takes the next invoice number of `year`. The counter row for the year is read
 * and advanced in the calling mutation's transaction, so two invoices written
 * at once never share a number, and a failed mutation takes no number.
 */
export const nextInvoiceNumber = Effect.fn(
  "billing.numbering.nextInvoiceNumber"
)(function* (year: number) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const counter = yield* reader
    .table("billingCounters")
    .index("by_year", (query) => query.eq("year", year))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(counter)) {
    yield* writer
      .table("billingCounters")
      .insert({ year, next: 2 })
      .pipe(Effect.orDie);
    return formatInvoiceNumber(year, 1);
  }
  const sequence = counter.value.next;
  if (sequence > MAX_INVOICE_SEQUENCE) {
    return yield* new InvoiceNumberExhausted({
      year,
      message: `Invoice numbers of ${year} are used up.`,
    });
  }
  yield* writer
    .table("billingCounters")
    .patch(counter.value._id, { next: sequence + 1 })
    .pipe(Effect.orDie);
  return formatInvoiceNumber(year, sequence);
});
