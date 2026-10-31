import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

/** One line of an invoice, its amount already written in the buyer's currency. */
const InvoiceLine = Schema.Struct({
  amount: Schema.String,
  description: Schema.String,
});

/**
 * One invoice as its PDF reads it: the number or payment it answers to, who it
 * bills, what it bills, and how it stands. Every date and amount is already
 * written in the invoice's language.
 */
export const InvoiceInput = Schema.Struct({
  buyer: Schema.Struct({
    email: Schema.NullOr(Schema.String),
    name: Schema.String,
  }),
  dueOn: Schema.NullOr(Schema.String),
  issuedOn: Schema.String,
  lines: Schema.NonEmptyArray(InvoiceLine),
  locale: ActiveAppLocaleCodeSchema,
  number: Schema.String,
  paidWith: Schema.NullOr(Schema.String),
  status: Schema.Literals(["open", "paid", "void"]),
  total: Schema.String,
});
