import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { Invoice01Icon } from "@hugeicons/core-free-icons";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
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
 * receipts are read while the card shows, so the dialog opens on its list.
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
          <PaymentsList payments={payments.value} />
        ) : null}
      </ResponsiveDialog>
    </>
  );
}

/**
 * The receipts, newest first: what each bought and its day on the left, its
 * amount and the provider that took it on the right. Each fact stays on its own
 * line at every width, so a phone never breaks a word or an amount.
 */
function PaymentsList({
  payments,
}: {
  payments: Ref.Returns<typeof billingRefs.queries.payments>;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();

  return (
    <ItemGroup aria-label={t("payments")} className="gap-2">
      {Arr.map(payments, (payment) => (
        <Item
          className="flex-nowrap"
          key={`${payment.rail}-${payment.paidAt}`}
          render={<li />}
          size="sm"
          variant="outline"
        >
          <ItemContent className="min-w-0">
            <ItemTitle>{t(PAYMENT_LABELS[payment.kind])}</ItemTitle>
            <ItemDescription className="line-clamp-1">
              {formatBillingDate(payment.paidAt, locale)}
            </ItemDescription>
          </ItemContent>
          <ItemContent className="items-end">
            <ItemTitle className="tabular-nums">
              {formatMinorAmount(payment.amount, payment.currency)}
            </ItemTitle>
            <ItemDescription className="line-clamp-1 text-right">
              {providerNameOf(payment.rail)}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
