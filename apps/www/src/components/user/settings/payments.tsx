import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { Invoice01Icon } from "@hugeicons/core-free-icons";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  formatBillingDate,
  formatMinorAmount,
  providerNameOf,
} from "@/lib/billing/plan";

/** The name of what each kind of payment bought. */
const PAYMENT_LABELS = {
  credits: "payment-credits",
  cycle: "payment-cycle",
  invoice: "payment-invoice",
  pass: "payment-pass",
} as const;

/**
 * The plan card's Payments action: a dialog of the learner's receipts. The
 * receipts are read while the card shows, so the dialog opens on its table.
 */
export function PlanPayments() {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const [isOpen, setIsOpen] = useState(false);
  const payments = useQuery(
    billingRefs.queries.payments,
    isAuthenticated ? {} : "skip"
  );
  if (QueryResult.isFailure(payments)) {
    throw payments.error;
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button" variant="outline">
        <HugeIcons icon={Invoice01Icon} />
        {t("payments")}
      </Button>
      <ResponsiveDialog
        description={t("payments-description")}
        footer={
          <Button
            onClick={() => setIsOpen(false)}
            type="button"
            variant="outline"
          >
            {common("close")}
          </Button>
        }
        open={isOpen}
        setOpen={setIsOpen}
        title={t("payments")}
      >
        {QueryResult.isSuccess(payments) ? (
          <PaymentsTable payments={payments.value} />
        ) : null}
      </ResponsiveDialog>
    </>
  );
}

/** The receipts, newest first, each with its day, what it bought, the provider that took it and its amount. */
function PaymentsTable({
  payments,
}: {
  payments: Ref.Returns<typeof billingRefs.queries.payments>;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("payment-date")}</TableHead>
          <TableHead>{t("payment-for")}</TableHead>
          <TableHead>{t("paid-with")}</TableHead>
          <TableHead className="text-end">{t("payment-amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Arr.map(payments, (payment) => (
          <TableRow key={`${payment.rail}-${payment.paidAt}`}>
            <TableCell>{formatBillingDate(payment.paidAt, locale)}</TableCell>
            <TableCell>{t(PAYMENT_LABELS[payment.kind])}</TableCell>
            <TableCell>{providerNameOf(payment.rail)}</TableCell>
            <TableCell className="text-end tabular-nums">
              {formatMinorAmount(payment.amount, payment.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
