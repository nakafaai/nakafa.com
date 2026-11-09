import type {
  ActiveAppLocaleCode,
  AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { SchoolLineKey } from "@repo/backend/confect/billing/quote";
import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { formatterOf } from "@repo/internationalization/src/formats";
import { formatCurrency } from "@repo/internationalization/src/money";
import { Array as Arr, Schema } from "effect";

/** What each kind of payment bought, in the language of the invoice. */
const PAYMENT_ITEMS = {
  de: {
    credits: "1.000 Nina-Credits",
    cycle: "Nakafa Pro Abo",
    invoice: "Nakafa School",
    pass: "Nakafa Pro Pass",
  },
  en: {
    credits: "1,000 Nina credits",
    cycle: "Nakafa Pro subscription",
    invoice: "Nakafa School",
    pass: "Nakafa Pro pass",
  },
  id: {
    credits: "1.000 kredit Nina",
    cycle: "Langganan Nakafa Pro",
    invoice: "Nakafa School",
    pass: "Pass Nakafa Pro",
  },
  ms: {
    credits: "1,000 kredit Nina",
    cycle: "Langganan Nakafa Pro",
    invoice: "Nakafa School",
    pass: "Pas Nakafa Pro",
  },
} as const satisfies Record<AppLocaleCode, Record<string, string>>;

/** What each School line buys, in the language of the invoice. The invoice's period says for how long. */
const SCHOOL_ITEMS = {
  de: {
    "school.accounts": "Zusätzliche Konten",
    "school.max": "Nakafa School Max",
    "school.pro": "Nakafa School Pro",
  },
  en: {
    "school.accounts": "Additional accounts",
    "school.max": "Nakafa School Max",
    "school.pro": "Nakafa School Pro",
  },
  id: {
    "school.accounts": "Akun tambahan",
    "school.max": "Nakafa School Max",
    "school.pro": "Nakafa School Pro",
  },
  ms: {
    "school.accounts": "Akaun tambahan",
    "school.max": "Nakafa School Max",
    "school.pro": "Nakafa School Pro",
  },
} as const satisfies Record<AppLocaleCode, Record<SchoolLineKey, string>>;

/** An invoice line's text: the words of a School line, or the text an operator wrote. */
const lineDescription = (description: string, locale: ActiveAppLocaleCode) =>
  Schema.is(SchoolLineKey)(description)
    ? SCHOOL_ITEMS[locale][description]
    : description;

/** The digits each currency keeps after the point in its minor unit. */
const MINOR_DIGITS = {
  EUR: 2,
  IDR: 0,
  MYR: 2,
  USD: 2,
} as const satisfies Record<BillingCurrency, number>;

/** An amount in its minor unit, written as the invoice's language writes that currency. */
const writtenAmount = (
  amount: number,
  currency: BillingCurrency,
  locale: ActiveAppLocaleCode
) =>
  formatCurrency(amount / 10 ** MINOR_DIGITS[currency], {
    currency,
    digits: MINOR_DIGITS[currency],
    locale,
  });

/**
 * The invoice of one paid payment as its PDF reads it. A payment has no number of
 * its own, so the provider's reference is what the invoice answers to.
 */
export function paymentInvoice(
  payment: Docs["billingPayments"],
  buyer: Pick<Docs["users"], "email" | "name">,
  locale: ActiveAppLocaleCode
): typeof InvoiceInput.Type {
  const total = writtenAmount(payment.amount, payment.currency, locale);
  return {
    buyer: { email: buyer.email, name: buyer.name },
    dueOn: null,
    issuedOn: formatterOf(locale).dateTime(payment.paidAt, "billing"),
    lines: [
      { amount: total, description: PAYMENT_ITEMS[locale][payment.kind] },
    ],
    locale,
    number: payment.providerPaymentId,
    paidWith: "Xendit",
    status: "paid",
    total,
  };
}

/** The invoice a school pays, as its PDF reads it: billed to the school, with its own number and due date. */
export function schoolInvoice(
  invoice: Pick<
    Docs["billingInvoices"],
    | "_creationTime"
    | "currency"
    | "dueAt"
    | "lines"
    | "number"
    | "status"
    | "total"
  >,
  school: string,
  locale: ActiveAppLocaleCode
): typeof InvoiceInput.Type {
  const formatter = formatterOf(locale);
  return {
    buyer: { email: null, name: school },
    dueOn:
      invoice.status === "open"
        ? formatter.dateTime(invoice.dueAt, "billing")
        : null,
    issuedOn: formatter.dateTime(invoice._creationTime, "billing"),
    lines: Arr.map(invoice.lines, (line) => ({
      amount: writtenAmount(line.amount, invoice.currency, locale),
      description: lineDescription(line.description, locale),
    })),
    locale,
    number: invoice.number,
    paidWith: invoice.status === "paid" ? "Xendit" : null,
    status: invoice.status === "draft" ? "open" : invoice.status,
    total: writtenAmount(invoice.total, invoice.currency, locale),
  };
}
