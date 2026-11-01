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
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, DateTime, Record as Rec } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { RowAction, useInvoiceDownload } from "@/components/billing/invoice";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import {
  BILLING_TIME_ZONE,
  formatBillingDate,
  formatCount,
  formatMinorAmount,
} from "@/lib/billing/plan";
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

/** The invoices of the school, newest first, each with the way it is paid while it is open. */
export function SchoolInvoicesCard({
  billing: overview,
}: {
  billing: SchoolBilling;
}) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());

  return (
    <CardSection
      description={t("billing-invoices-description")}
      title={t("billing-invoices")}
    >
      {Arr.isReadonlyArrayNonEmpty(overview.invoices) ? (
        <CardContent>
          <TableFiltersProvider>
            <TableFrame>
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
                        end: formatBillingDate(
                          info.row.original.periodEnd - 1,
                          locale
                        ),
                        start: formatBillingDate(info.getValue(), locale),
                      }),
                    header: t("invoice-term"),
                    id: "term",
                    timeZone: () => BILLING_TIME_ZONE,
                  }),
                  invoiceColumns.number((invoice) => invoice.seats, {
                    cell: (info) => formatCount(info.getValue(), locale),
                    header: t("invoice-students"),
                    id: "students",
                  }),
                  invoiceColumns.number((invoice) => invoice.total, {
                    cell: (info) =>
                      formatMinorAmount(
                        info.getValue(),
                        info.row.original.currency
                      ),
                    header: t("invoice-total"),
                    id: "total",
                  }),
                  invoiceColumns.days((invoice) => invoice.dueAt, {
                    cell: (info) => formatBillingDate(info.getValue(), locale),
                    header: t("invoice-due"),
                    id: "due",
                    timeZone: () => BILLING_TIME_ZONE,
                  }),
                  invoiceColumns.values(
                    (invoice) => invoiceStanding(invoice, now),
                    {
                      cell: (info) => (
                        <TableStatus
                          {...INVOICE_LOOKS[info.getValue()]}
                          label={t(`invoice-${info.getValue()}`)}
                        />
                      ),
                      header: t("invoice-status"),
                      id: "status",
                      options: Arr.map(
                        Rec.toEntries(INVOICE_LOOKS),
                        ([status, look]) => ({
                          icon: look.icon,
                          label: t(`invoice-${status}`),
                          value: status,
                        })
                      ),
                    }
                  ),
                  invoiceColumns.menu((info) => (
                    <div className="flex items-center justify-end gap-1">
                      <SchoolInvoiceDownload invoice={info.row.original} />
                      <SchoolInvoiceAction
                        invoice={info.row.original}
                        now={now}
                      />
                    </div>
                  )),
                ]}
                data={overview.invoices}
                rowId={(invoice) => `${invoice.number}-${invoice.periodStart}`}
              />
            </TableFrame>
          </TableFiltersProvider>
        </CardContent>
      ) : null}
      <CardSectionFooter
        hint={
          Arr.isReadonlyArrayNonEmpty(overview.invoices)
            ? t("billing-invoices-footer")
            : t("billing-invoices-empty")
        }
      />
    </CardSection>
  );
}

/** Hands over the PDF of an invoice that already holds its number. */
function SchoolInvoiceDownload({
  invoice,
}: {
  invoice: SchoolBilling["invoices"][number];
}) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const { slug } = useTenant();
  const draw = useAction(billing.receipts.school);
  const { download, isPending } = useInvoiceDownload();

  if (invoice.number === "" || !isActiveLocale(locale)) {
    return null;
  }
  return (
    <RowAction
      icon={Download04Icon}
      isPending={isPending}
      label={t("invoice-download")}
      onClick={() =>
        download(() => draw({ locale, number: invoice.number, slug }))
      }
    />
  );
}

/**
 * How an open invoice is paid, behind the row's menu: on its hosted payment page
 * while it holds one and its due day has not passed, since the page closes on that
 * day, or by bank transfer to Nakafa, which an operator records. A paid or void
 * invoice needs nothing, and an invoice still being issued has no number to quote yet.
 */
function SchoolInvoiceAction({
  invoice,
  now,
}: {
  invoice: SchoolBilling["invoices"][number];
  now: number;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");

  if (invoice.status !== "open" || invoice.number === "") {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={common("more-actions")}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons icon={MoreHorizontalIcon} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {invoice.paymentLink === null ||
        invoiceStanding(invoice, now) === "overdue" ? (
          <DropdownMenuItem
            render={
              <a
                href={transferMailto(invoice.number)}
                title={t("invoice-transfer")}
              />
            }
          >
            <HugeIcons icon={Mail01Icon} />
            {t("invoice-transfer")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            render={
              <a
                href={invoice.paymentLink}
                rel="noopener"
                target="_blank"
                title={t("invoice-pay")}
              />
            }
          >
            <HugeIcons icon={CreditCardIcon} />
            {t("invoice-pay")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
