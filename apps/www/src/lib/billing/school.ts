import type { Ref } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import billing from "@repo/backend/confect/_generated/refs/billing";
import {
  accountsQuote,
  planQuote,
  SchoolOrder,
  schoolPeriod,
} from "@repo/backend/confect/billing/quote";
import { lineAccounts } from "@repo/backend/confect/billing/tier";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr, DateTime, Duration, Option } from "effect";

/** The school's billing as its settings page reads it. */
export type SchoolBilling = Ref.Returns<typeof billing.school.overview>;

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

/** Where an invoice stands at `now`: an open one past its due day is overdue, whatever its table holds. */
export function invoiceStanding(
  invoice: Pick<SchoolBilling["invoices"][number], "dueAt" | "status">,
  now: number
) {
  return invoice.status === "open" && invoice.dueAt < now
    ? ("overdue" as const)
    : invoice.status;
}

/** The open invoice the school still has to pay at `now`: the server issues no other while it waits. */
export function openInvoice(overview: SchoolBilling, now: number) {
  return Arr.findFirst(
    overview.invoices,
    (invoice) => invoice.status === "open" && invoice.periodEnd > now
  );
}

/** The paid plan that runs, with its period, while one runs. */
export function paidPlan(overview: SchoolBilling) {
  const { plan } = overview;
  return plan.kind === "pro" || plan.kind === "max"
    ? Option.some(plan)
    : Option.none();
}

/**
 * What one order costs and the period it covers, as the server will issue it at
 * `now`: a plan runs from the end of the plan that runs, or from now; more
 * accounts run from now to the end of the running plan, prorated. An order of
 * accounts with no plan running quotes nothing, since the server refuses it.
 */
export function orderQuote(
  overview: SchoolBilling,
  order: SchoolOrder,
  now: number
) {
  const running = paidPlan(overview);
  return SchoolOrder.match(order, {
    plan: ({ accounts, months, plan }) =>
      Option.some({
        period: schoolPeriod(
          Option.match(running, {
            onNone: () => now,
            onSome: (current) => current.period.end,
          }),
          months
        ),
        quote: planQuote({
          accounts,
          currency: overview.currency,
          months,
          plan,
        }),
      }),
    accounts: ({ accounts }) =>
      Option.map(running, (current) => ({
        period: {
          end: current.period.end,
          months: current.period.months,
          start: now,
        },
        quote: accountsQuote({
          accounts,
          currency: overview.currency,
          from: now,
          period: current.period,
        }),
      })),
  });
}

/**
 * Lists the invoice a school asks for at once, at the top of its invoices: the
 * order's quote, open and due in 14 days, with no number until the server issues
 * it. While an open invoice waits, the server returns it, so nothing is listed.
 */
export const schoolPayChange: OptimisticUpdate<typeof billing.school.pay> = (
  localStore,
  { order, slug }
) => {
  const current = localStore.getQuery(billing.school.overview, { slug });
  if (Option.isNone(current)) {
    return;
  }
  const overview = current.value;
  const now = DateTime.nowUnsafe();
  const at = DateTime.toEpochMillis(now);
  if (Option.isSome(openInvoice(overview, at))) {
    return;
  }
  const draft = orderQuote(overview, order, at);
  if (Option.isNone(draft)) {
    return;
  }
  localStore.setQuery(
    billing.school.overview,
    { slug },
    Option.some({
      ...overview,
      invoices: Arr.prepend(overview.invoices, {
        number: "",
        status: "open" as const,
        currency: overview.currency,
        total: draft.value.quote.total,
        periodStart: draft.value.period.start,
        periodEnd: draft.value.period.end,
        dueAt: DateTime.toEpochMillis(DateTime.addDuration(now, INVOICE_DUE)),
        paymentLink: null,
        accounts: Arr.reduce(
          draft.value.quote.lines,
          0,
          (total, line) => total + lineAccounts(line.description, line.quantity)
        ),
      }),
    })
  );
};
