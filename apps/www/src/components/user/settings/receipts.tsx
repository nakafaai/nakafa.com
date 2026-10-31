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
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Effect, Option, Record as Rec } from "effect";
import { type ComponentProps, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { HeadAlignContext } from "@/components/shared/table/align";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import { daysColumn } from "@/components/shared/table/days";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { namedOptions } from "@/components/shared/table/filter";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { reportClientException } from "@/lib/analytics/client";
import { useBillingNavigation } from "@/lib/billing/checkout";
import { invoiceBlob } from "@/lib/billing/invoice";
import {
  BILLING_TIME_ZONE,
  formatBillingDay,
  formatMinorAmount,
} from "@/lib/billing/plan";
import { isActiveLocale } from "@/lib/i18n/active";

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

/** What a learner reads when an invoice cannot be drawn. */
const INVOICE_FAILURE_COPY: ToastCopy = {
  description: "invoice-error.description",
  title: "invoice-error.title",
};

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

/** Hands the learner one drawn invoice as a file. */
const saveInvoice = (blob: Blob, name: string) =>
  Effect.sync(() => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  });

/** One row's action: an icon button that names itself in a tooltip and shows its work. */
function RowAction({
  icon,
  isPending,
  label,
  onClick,
}: {
  icon: ComponentProps<typeof Spinner>["icon"];
  isPending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={isPending}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Spinner icon={icon} isLoading={isPending} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Draws the invoice of a payment Nakafa sold, and saves it. */
function InvoiceAction({ payment }: { payment: Receipt }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const download = useAction(billingRefs.receipts.download);
  const [isPending, startTransition] = useTransition();

  const handleDownload = () => {
    if (!isActiveLocale(locale)) {
      return;
    }
    startTransition(() =>
      Effect.runPromise(
        Effect.tryPromise(() =>
          download({ locale, paymentId: payment.id })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.flatMap((file) =>
            invoiceBlob(file.base64).pipe(
              Effect.flatMap((blob) => saveInvoice(blob, file.name))
            )
          ),
          Effect.tapError((cause) =>
            reportClientException(cause, { source: "settings-invoice" })
          ),
          Effect.catchCause(() =>
            Effect.sync(() => {
              toast.error(INVOICE_FAILURE_COPY, { position: "bottom-center" });
            })
          )
        )
      )
    );
  };

  return (
    <RowAction
      icon={Download04Icon}
      isPending={isPending}
      label={t("payment-download")}
      onClick={handleDownload}
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
      cell: (info) => formatBillingDay(info.getValue(), locale),
      header: t("payment-date"),
      id: "date",
      sortFn: "basic",
    }),
<<<<<<< HEAD
=======
    receiptColumns.accessor((payment) => providerNameOf(payment.rail), {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="provider"
          options={providers}
          title={t("payment-via")}
        />
      ),
      id: "provider",
    }),
>>>>>>> nabil/takumipdf
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
      meta: { align: "figure" },
    }),
    receiptColumns.display({
      cell: (info) =>
        info.row.original.rail === "xendit" ? (
          <InvoiceAction payment={info.row.original} />
        ) : (
          <PortalAction />
        ),
      header: "",
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

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
