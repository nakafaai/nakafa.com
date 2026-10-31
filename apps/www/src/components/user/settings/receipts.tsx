import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Coins01Icon,
  CreditCardIcon,
  Invoice01Icon,
  Money01Icon,
  RepeatIcon,
  Ticket01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Record as Rec } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { HeadAlignContext } from "@/components/shared/table/align";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import { daysColumn } from "@/components/shared/table/days";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { namedOptions } from "@/components/shared/table/filter";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import {
  BILLING_TIME_ZONE,
  formatBillingDate,
  formatMinorAmount,
  providerNameOf,
} from "@/lib/billing/plan";

/** One receipt as the payments query answers it. */
type Receipt = Ref.Returns<typeof billingRefs.queries.payments>[number];

/** The columns of the receipts table. */
const receiptColumns = createColumnHelper<typeof dataTableFeatures, Receipt>();

/** What each kind of payment bought, with the icon its filter draws. */
const PAYMENT_KINDS = {
  credits: { icon: Coins01Icon, label: "payment-credits" },
  cycle: { icon: RepeatIcon, label: "payment-cycle" },
  invoice: { icon: Invoice01Icon, label: "payment-invoice" },
  pass: { icon: Ticket01Icon, label: "payment-pass" },
} as const;

/** The icons of the providers in a filter. */
const PROVIDER_ICONS = {
  polar: CreditCardIcon,
  xendit: Wallet01Icon,
} as const;

/**
 * The learner's receipts, read once the sheet opens so the plan card reads none.
 * Every column filters, and a filter that leaves no row says so in the table.
 */
export function Receipts() {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const payments = useQuery(
    billingRefs.queries.payments,
    isAuthenticated ? {} : "skip"
  );
  if (QueryResult.isFailure(payments)) {
    throw payments.error;
  }
  if (!QueryResult.isSuccess(payments)) {
    return null;
  }

  return (
    <TableFiltersProvider>
      <ReceiptsTable payments={payments.value} />
    </TableFiltersProvider>
  );
}

/** The receipts, newest first: what each bought, its day, the provider that took it, and its amount. */
function ReceiptsTable({ payments }: { payments: readonly Receipt[] }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const kindOf = (payment: Receipt) => t(PAYMENT_KINDS[payment.kind].label);
  const amountOf = (payment: Receipt) =>
    formatMinorAmount(payment.amount, payment.currency);
  const kinds = Arr.map(Rec.toEntries(PAYMENT_KINDS), ([, kind]) => ({
    icon: kind.icon,
    label: t(kind.label),
    value: t(kind.label),
  }));
  const providers = Arr.map(Rec.toEntries(PROVIDER_ICONS), ([rail, icon]) => ({
    icon,
    label: providerNameOf(rail),
    value: providerNameOf(rail),
  }));
  const amounts = namedOptions(Arr.dedupe(Arr.map(payments, amountOf)), [
    Money01Icon,
  ]);

  const columns = receiptColumns.columns([
    receiptColumns.accessor(kindOf, {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <HeadAlignContext value="start">
          <ColumnFilter
            column="kind"
            options={kinds}
            title={t("payment-for")}
          />
        </HeadAlignContext>
      ),
      id: "kind",
    }),
    receiptColumns.accessor((payment) => payment.paidAt, {
      ...daysColumn(Option.some(BILLING_TIME_ZONE)),
      cell: (info) => formatBillingDate(info.getValue(), locale),
      header: t("payment-date"),
      id: "date",
      sortFn: "basic",
    }),
    receiptColumns.accessor((payment) => providerNameOf(payment.rail), {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="provider"
          options={providers}
          title={t("paid-with")}
        />
      ),
      id: "provider",
    }),
    receiptColumns.accessor(amountOf, {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <HeadAlignContext value="end">
          <ColumnFilter
            column="amount"
            options={amounts}
            title={t("payment-amount")}
          />
        </HeadAlignContext>
      ),
      id: "amount",
      meta: { align: "end" },
    }),
  ]);

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col">
      <DataTable
        columns={columns}
        data={payments}
        rowId={(payment) => `${payment.rail}-${payment.paidAt}`}
      />
    </div>
  );
}
