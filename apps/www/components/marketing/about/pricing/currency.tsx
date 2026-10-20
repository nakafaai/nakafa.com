import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import type { PricingCurrency } from "@/lib/pricing/monthly";

/**
 * The layout of one currency branch. The root document sets the visitor's
 * currency before the first paint, so only the matching branch lays out, and a
 * hidden branch keeps no box. Without that attribute the dollar branch shows.
 */
const currencyBranchVariants = cva("", {
  variants: {
    currency: {
      EUR: "in-data-[currency=EUR]:contents hidden",
      IDR: "in-data-[currency=IDR]:contents hidden",
      USD: "in-data-[currency=EUR]:hidden in-data-[currency=IDR]:hidden",
    },
  },
});

/**
 * One price currency's branch. A page renders one branch per currency, so the
 * static page carries every price, and the visitor's currency is chosen by the
 * pre-paint script and never by a request-time read.
 */
export function CurrencyBranch({
  children,
  currency,
}: {
  children: ReactNode;
  currency: PricingCurrency;
}) {
  return (
    <div
      className={currencyBranchVariants({ currency })}
      data-price-currency={currency}
    >
      {children}
    </div>
  );
}
