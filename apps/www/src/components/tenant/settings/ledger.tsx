import { useAction } from "@confect/react";
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  CreditCardIcon,
  Download04Icon,
  Edit02Icon,
  Invoice01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { BILLING_TIME_ZONE } from "@repo/internationalization/src/formats";
import { Array as Arr, DateTime, Record as Rec } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { useInvoiceDownload } from "@/components/billing/invoice";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { RowItems } from "@/components/shared/table/menu";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { formatMinorAmount } from "@/lib/billing/plan";
import {
  invoiceStanding,
  type SchoolBilling,
  transferMailto,
} from "@/lib/billing/school";
import { isActiveLocale } from "@/lib/i18n/active";

/** The look of each standing of an invoice in its table. */
const INVOICE_LOOKS = {
  draft: { icon: Edit02Icon, tone: "neutral" },
  open: { icon: Invoice01Icon, tone: "warning" },
  overdue: { icon: Alert02Icon, tone: "destructive" },
  paid: { icon: CheckmarkBadge01Icon, tone: "success" },
  void: { icon: Cancel01Icon, tone: "neutral" },
} as const satisfies Record<ReturnType<typeof invoiceStanding>, StatusLook>;

/** The columns of the school's invoices. */
const invoiceColumns = tableColumns<SchoolBilling["invoices"][number]>();

/**
 * The invoices of the school in the sheet the invoices card opens, newest first, each
 * filtered by its columns and with the way it is paid while it is open.
 */
export function SchoolInvoices({
  billing: overview,
}: {
  billing: SchoolBilling;
}) {
  const t = useTranslations("SchoolSettings");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());

  return (
    <TableFiltersProvider>
      <div className="bg-card flex min-h-0 flex-1 flex-col">
        <DataTable
          columns={[
            invoiceColumns.text((invoice) => invoice.number, {
              cell: (info) => (
                <span className="font-medium">{info.getValue()}</span>
              ),
              header: t("invoice-number"),
              id: "number",
            }),
            invoiceColumns.days((invoice) => invoice.periodStart, {
              cell: (info) =>
                t("billing-term-dates", {
                  end: format.dateTime(
                    info.row.original.periodEnd - 1,
                    "billing"
                  ),
                  start: format.dateTime(info.getValue(), "billing"),
                }),
              header: t("invoice-term"),
              id: "term",
              timeZone: () => BILLING_TIME_ZONE,
            }),
            invoiceColumns.number((invoice) => invoice.accounts, {
              cell: (info) => format.number(info.getValue()),
              header: tCommon("accounts"),
              id: "accounts",
            }),
            invoiceColumns.number((invoice) => invoice.total, {
              cell: (info) =>
                formatMinorAmount(info.getValue(), info.row.original.currency),
              header: tCommon("total"),
              id: "total",
            }),
            invoiceColumns.days((invoice) => invoice.dueAt, {
              cell: (info) => format.dateTime(info.getValue(), "billing"),
              header: t("invoice-due"),
              id: "due",
              timeZone: () => BILLING_TIME_ZONE,
            }),
            invoiceColumns.values((invoice) => invoiceStanding(invoice, now), {
              cell: (info) => (
                <TableStatus
                  {...INVOICE_LOOKS[info.getValue()]}
                  label={t(`invoice.${info.getValue()}`)}
                />
              ),
              header: tCommon("state"),
              id: "status",
              options: Arr.map(
                Rec.toEntries(INVOICE_LOOKS),
                ([status, look]) => ({
                  icon: look.icon,
                  label: t(`invoice.${status}`),
                  value: status,
                })
              ),
            }),
            invoiceColumns.menu((info) => (
              <SchoolInvoiceMenu invoice={info.row.original} now={now} />
            )),
          ]}
          data={overview.invoices}
          rowId={(invoice) => `${invoice.number}-${invoice.periodStart}`}
        />
      </div>
    </TableFiltersProvider>
  );
}

/**
 * What a row of the invoices offers: the PDF of an invoice that already holds its number, and how an open one is paid, on
 * its hosted payment page while it holds one and its due day has not passed, since the page closes on that day, or by bank
 * transfer to Nakafa, which an operator records. An invoice still being issued has no number to quote yet, so its PDF stays
 * in view, disabled.
 */
function SchoolInvoiceMenu({
  invoice,
  now,
}: {
  invoice: SchoolBilling["invoices"][number];
  now: number;
}) {
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { slug } = useTenant();
  const draw = useAction(billing.receipts.school);
  const { download, isPending } = useInvoiceDownload();
  const hasNumber = invoice.number !== "";

  return (
    <RowItems>
      <DropdownMenuItem
        disabled={!(hasNumber && isActiveLocale(locale)) || isPending}
        icon={Download04Icon}
        onClick={() => {
          if (isActiveLocale(locale)) {
            download(() => draw({ locale, number: invoice.number, slug }));
          }
        }}
      >
        {tCommon("download-invoice")}
      </DropdownMenuItem>
      {invoice.status === "open" && hasNumber ? (
        <SchoolInvoicePay
          link={
            invoiceStanding(invoice, now) === "overdue"
              ? null
              : invoice.paymentLink
          }
          number={invoice.number}
        />
      ) : null}
    </RowItems>
  );
}

/** How an open invoice is paid: on its hosted payment page when `link` holds one, or by bank transfer quoting `number`. */
function SchoolInvoicePay({
  link,
  number,
}: {
  link: SchoolBilling["invoices"][number]["paymentLink"];
  number: SchoolBilling["invoices"][number]["number"];
}) {
  const t = useTranslations("SchoolSettings");

  return link === null ? (
    <DropdownMenuItem
      icon={Mail01Icon}
      render={<a href={transferMailto(number)} title={t("invoice-transfer")} />}
    >
      {t("invoice-transfer")}
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem
      icon={CreditCardIcon}
      render={
        <a
          href={link}
          rel="noopener"
          target="_blank"
          title={t("invoice-pay")}
        />
      }
    >
      {t("invoice-pay")}
    </DropdownMenuItem>
  );
}
