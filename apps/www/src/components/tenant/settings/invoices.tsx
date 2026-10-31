import {
  Cancel01Icon,
  CheckmarkBadge01Icon,
  CreditCardIcon,
  Edit02Icon,
  Invoice01Icon,
  Mail01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  formatBillingDate,
  formatCount,
  formatMinorAmount,
} from "@/lib/billing/plan";
import { type SchoolBilling, transferMailto } from "@/lib/billing/school";

/** The look of each state of an invoice in its table. */
const INVOICE_LOOKS = {
  draft: { icon: Edit02Icon, tone: "neutral" },
  open: { icon: Invoice01Icon, tone: "warning" },
  paid: { icon: CheckmarkBadge01Icon, tone: "success" },
  void: { icon: Cancel01Icon, tone: "neutral" },
} as const satisfies Record<
  SchoolBilling["invoices"][number]["status"],
  StatusLook
>;

/** The invoices of the school, newest first, each with the way it is paid while it is open. */
export function SchoolInvoicesCard({
  billing: overview,
}: {
  billing: SchoolBilling;
}) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();

  return (
    <CardSection
      description={t("billing-invoices-description")}
      title={t("billing-invoices")}
    >
      {Arr.isReadonlyArrayNonEmpty(overview.invoices) ? (
        <CardContent>
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={columnAlign({ align: "start" })}>
                    {t("invoice-number")}
                  </TableHead>
                  <TableHead className={columnAlign()}>
                    {t("invoice-term")}
                  </TableHead>
                  <TableHead className={columnAlign()}>
                    {t("invoice-students")}
                  </TableHead>
                  <TableHead className={columnAlign()}>
                    {t("invoice-total")}
                  </TableHead>
                  <TableHead className={columnAlign()}>
                    {t("invoice-status")}
                  </TableHead>
                  <TableHead className={columnAlign({ align: "menu" })}>
                    <span className="sr-only">{t("invoice-pay")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Arr.map(overview.invoices, (invoice) => (
                  <TableRow key={`${invoice.number}-${invoice.periodStart}`}>
                    <TableCell
                      className={columnAlign({
                        align: "start",
                        className: "font-medium",
                      })}
                    >
                      {invoice.number}
                    </TableCell>
                    <TableCell className={columnAlign()}>
                      {t("billing-term-dates", {
                        end: formatBillingDate(invoice.periodEnd - 1, locale),
                        start: formatBillingDate(invoice.periodStart, locale),
                      })}
                    </TableCell>
                    <TableCell className={columnAlign()}>
                      {formatCount(invoice.seats, locale)}
                    </TableCell>
                    <TableCell className={columnAlign()}>
                      {formatMinorAmount(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell className={columnAlign()}>
                      <TableStatus
                        {...INVOICE_LOOKS[invoice.status]}
                        label={t(`invoice-${invoice.status}`)}
                      />
                    </TableCell>
                    <TableCell className={columnAlign({ align: "menu" })}>
                      <SchoolInvoiceAction invoice={invoice} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
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

/**
 * How an open invoice is paid, behind the row's menu: on its hosted payment page
 * while it holds one, or by bank transfer to Nakafa, which an operator records. A
 * paid or void invoice needs nothing, and an invoice still being issued has no
 * number to quote yet.
 */
function SchoolInvoiceAction({
  invoice,
}: {
  invoice: SchoolBilling["invoices"][number];
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
        {invoice.paymentLink === null ? (
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
