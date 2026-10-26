import type { Ref } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr, DateTime, Duration, Option } from "effect";

/** The school's billing as its settings page reads it. */
export type SchoolBilling = Ref.Returns<typeof billing.school.overview>;

/** One School offer the billing page can quote. */
export type SchoolOffer = SchoolBilling["quotes"][number]["offer"];

/**
 * What paying one offer means on a school's rail: an Indonesian school is issued
 * an invoice for a term, and any other school buys monthly or yearly Polar seats.
 * An offer the rail does not sell buys nothing.
 */
export function purchaseOf(rail: SchoolBilling["rail"], offer: SchoolOffer) {
  if (rail === "xendit" && offer !== "school.seat.month") {
    return { kind: "invoice" as const, offer };
  }
  if (rail === "polar" && offer !== "school.seat.semester") {
    return { kind: "seats" as const, offer };
  }
  return null;
}

/** How long a school has to pay an invoice, as the server sets it when it issues one. */
const INVOICE_DUE = Duration.days(14);

/**
 * The address a school writes to when it pays an invoice by bank transfer: Nakafa's
 * own mailbox, with the invoice number as the subject, so the transfer finds its
 * invoice. An operator records the transfer once it arrives.
 */
export function transferMailto(number: string) {
  const url = new URL(`mailto:${COMPANY_IDENTITY.email}`);
  url.searchParams.set("subject", number);
  return url.href;
}

/**
 * The sentence under the plan: what paying does when there are students to pay
 * for, and otherwise why there is nothing to pay.
 */
export function planHintKey(overview: SchoolBilling) {
  const free = overview.plan.kind === "free";
  if (Arr.isReadonlyArrayNonEmpty(overview.quotes)) {
    return free ? "billing-free-footer" : "billing-add-footer";
  }
  return free ? "billing-free-empty" : "billing-school-footer";
}

/**
 * Lists the invoice a school asks for at once, at the top of its invoices: the
 * chosen term's quote, open and due in 14 days, with no number until the server
 * issues it. A term that already has an open invoice lists nothing new, because the
 * server returns that invoice.
 */
export const schoolPayChange: OptimisticUpdate<typeof billing.school.pay> = (
  localStore,
  { offer, slug }
) => {
  const current = localStore.getQuery(billing.school.overview, { slug });
  if (Option.isNone(current)) {
    return;
  }
  const overview = current.value;
  const quote = Arr.findFirst(overview.quotes, (q) => q.offer === offer);
  if (Option.isNone(quote)) {
    return;
  }
  const alreadyOpen = Arr.some(
    overview.invoices,
    (invoice) =>
      invoice.status === "open" &&
      invoice.periodStart === quote.value.periodStart &&
      invoice.periodEnd === quote.value.periodEnd
  );
  if (alreadyOpen) {
    return;
  }
  const now = DateTime.nowUnsafe();
  localStore.setQuery(
    billing.school.overview,
    { slug },
    Option.some({
      ...overview,
      invoices: Arr.prepend(overview.invoices, {
        number: "",
        status: "open" as const,
        currency: overview.currency,
        total: quote.value.total,
        periodStart: quote.value.periodStart,
        periodEnd: quote.value.periodEnd,
        dueAt: DateTime.toEpochMillis(DateTime.addDuration(now, INVOICE_DUE)),
        paymentLink: null,
        seats: quote.value.seats,
      }),
    })
  );
};
