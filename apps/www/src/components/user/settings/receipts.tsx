import type { Ref } from "@confect/core";
import { QueryResult, useAction, useQuery } from "@confect/react";
import {
  Coins01Icon,
  Download04Icon,
  Invoice01Icon,
  LinkSquare02Icon,
  Money01Icon,
  RepeatIcon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { Array as Arr, Record as Rec } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { RowAction, useInvoiceDownload } from "@/components/billing/invoice";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useBillingNavigation } from "@/lib/billing/checkout";
import {
  BILLING_TIME_ZONE,
  formatBillingDay,
  formatMinorAmount,
} from "@/lib/billing/plan";
import { isActiveLocale } from "@/lib/i18n/active";

/** One receipt as the payments query answers it. */
type Receipt = Ref.Returns<typeof billingRefs.queries.payments>[number];

/** The columns of the receipts table. */
const receiptColumns = tableColumns<Receipt>();

/** What each kind of payment bought, with the icon its filter draws. */
const PAYMENT_KINDS = {
  credits: { icon: Coins01Icon, label: "payment-credits" },
  cycle: { icon: RepeatIcon, label: "payment-cycle" },
  invoice: { icon: Invoice01Icon, label: "payment-invoice" },
  pass: { icon: Ticket01Icon, label: "payment-pass" },
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

/** Draws the invoice of a payment Nakafa sold, and saves it. */
function InvoiceAction({ payment }: { payment: Receipt }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const draw = useAction(billingRefs.receipts.download);
  const { download, isPending } = useInvoiceDownload();

  if (!isActiveLocale(locale)) {
    return null;
  }
  return (
    <RowAction
      icon={Download04Icon}
      isPending={isPending}
      label={t("payment-download")}
      onClick={() => download(() => draw({ locale, paymentId: payment.id }))}
    />
  );
}

/** Opens Polar's portal, which holds the invoices of what Polar sold. */
function PortalAction() {
  const t = useTranslations("Auth");
  const billing = useBillingNavigation();

  return (
    <RowAction
      icon={LinkSquare02Icon}
      isPending={billing.isPending}
      label={t("payment-portal")}
      onClick={() => billing.openPortal({ source: "settings-invoice" })}
    />
  );
}

/** The receipts, newest first: what each bought, its day, its amount, and its invoice. */
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
  const amounts = namedOptions(Arr.dedupe(Arr.map(payments, amountOf)), [
    Money01Icon,
  ]);

  const columns = [
    receiptColumns.values(kindOf, {
      header: t("payment-for"),
      id: "kind",
      options: kinds,
    }),
    receiptColumns.days((payment) => payment.paidAt, {
      cell: (info) => formatBillingDay(info.getValue(), locale),
      header: t("payment-date"),
      id: "date",
      timeZone: () => BILLING_TIME_ZONE,
    }),
    receiptColumns.values(amountOf, {
      align: "figure",
      header: t("payment-amount"),
      id: "amount",
      options: amounts,
    }),
    receiptColumns.menu((info) =>
      info.row.original.rail === "xendit" ? (
        <InvoiceAction payment={info.row.original} />
      ) : (
        <PortalAction />
      )
    ),
  ];

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col">
      <DataTable
        columns={columns}
        data={payments}
        rowId={(payment) => payment.id}
      />
    </div>
  );
}
