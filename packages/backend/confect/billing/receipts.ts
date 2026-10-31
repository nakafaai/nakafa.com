import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import type { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { Array as Arr } from "effect";

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
} as const;

/** The digits each currency keeps after the point in its minor unit. */
const MINOR_DIGITS = {
  EUR: 2,
  IDR: 0,
  USD: 2,
} as const satisfies Record<BillingCurrency, number>;

/** The zone an invoice's date reads in, the one the settings show dates in. */
const INVOICE_TIME_ZONE = "Asia/Jakarta";

/** An amount in its minor unit, written as the invoice's language writes that currency. */
const writtenAmount = (
  amount: number,
  currency: BillingCurrency,
  locale: ActiveAppLocaleCode
) =>
  new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: MINOR_DIGITS[currency],
    minimumFractionDigits: MINOR_DIGITS[currency],
    style: "currency",
  }).format(amount / 10 ** MINOR_DIGITS[currency]);

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
    issuedOn: new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeZone: INVOICE_TIME_ZONE,
    }).format(payment.paidAt),
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
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: INVOICE_TIME_ZONE,
  });
  return {
    buyer: { email: null, name: school },
    dueOn: invoice.status === "open" ? date.format(invoice.dueAt) : null,
    issuedOn: date.format(invoice._creationTime),
    lines: Arr.map(invoice.lines, (line) => ({
      amount: writtenAmount(line.amount, invoice.currency, locale),
      description: line.description,
    })),
    locale,
    number: invoice.number,
    paidWith: invoice.status === "paid" ? "Xendit" : null,
    status: invoice.status === "draft" ? "open" : invoice.status,
    total: writtenAmount(invoice.total, invoice.currency, locale),
  };
}
