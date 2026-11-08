import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { Array as Arr } from "effect";
import { CurrencyText } from "@/components/marketing/about/pricing/currency";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";
import { formatSchoolPrice } from "@/lib/pricing/school";

/**
 * One School amount in every currency, of which the visitor's lays out, as the
 * Pro prices are drawn: the static page carries every price, and the root's
 * pre-paint script picks the currency, never a request-time read.
 */
export function SchoolAmount({
  amounts,
}: {
  amounts: Readonly<Record<BillingCurrency, number>>;
}) {
  return Arr.map(PricingCurrencySchema.literals, (currency) => (
    <CurrencyText currency={currency} key={currency}>
      {formatSchoolPrice(currency, amounts[currency])}
    </CurrencyText>
  ));
}
