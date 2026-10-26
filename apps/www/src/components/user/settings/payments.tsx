import { QueryResult, useQuery } from "@confect/react";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
import { useConvexAuth } from "@/components/auth/convex";
import { CardSection } from "@/components/shared/card/section";
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
 * The learner's receipts: the payments that went through, newest first, each
 * with its day, what it bought, its amount and the provider that took it. The
 * card shows once the read arrives, and only when there is a payment to list.
 */
export function UserSettingsPayments() {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const t = useTranslations("Auth");
  const locale = useLocale();
  const payments = useQuery(
    billingRefs.queries.payments,
    isAuthenticated ? {} : "skip"
  );
  if (QueryResult.isFailure(payments)) {
    throw payments.error;
  }
  if (
    !(
      QueryResult.isSuccess(payments) &&
      Arr.isReadonlyArrayNonEmpty(payments.value)
    )
  ) {
    return null;
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("payments")}</CardTitle>
        <CardDescription>{t("payments-description")}</CardDescription>
      </CardHeader>
      <CardContent>
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
            {Arr.map(payments.value, (payment) => (
              <TableRow key={`${payment.rail}-${payment.paidAt}`}>
                <TableCell>
                  {formatBillingDate(payment.paidAt, locale)}
                </TableCell>
                <TableCell>{t(PAYMENT_LABELS[payment.kind])}</TableCell>
                <TableCell>{providerNameOf(payment.rail)}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatMinorAmount(payment.amount, payment.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </CardSection>
  );
}
