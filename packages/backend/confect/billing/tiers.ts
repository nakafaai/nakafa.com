/**
 * The School plans a school buys, as the owner's final School report fixes them
 * (Nakafa School FINAL, 2 November 2026): what each plan holds, its monthly price
 * in each currency, the discount of each billing period, the custom account, and
 * the add-ons. Every School price on a page and in a quote comes from here.
 * Prices are in the currency's minor unit (rupiah, cents) and exclude tax.
 * Browser code imports this module, so it reads no secret and no server setting.
 */

import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { Array as Arr, Schema } from "effect";

/** The School plans, from the free trial up. Every plan holds every feature. */
export const SchoolTierKey = Schema.Literals(["free", "pro", "max"]);
export type SchoolTierKey = typeof SchoolTierKey.Type;

/** The plans a school pays for, which a custom account extends. */
export const SchoolPaidTierKey = Schema.Literals(["pro", "max"]);
export type SchoolPaidTierKey = typeof SchoolPaidTierKey.Type;

/** The billing periods a school pays for in advance, in months. */
export const SchoolPeriod = Schema.Literals([1, 3, 6, 12]);
export type SchoolPeriod = typeof SchoolPeriod.Type;

/** One amount in every currency a school is billed in, in minor units. */
const SchoolPrices = Schema.Struct({
  EUR: Schema.Int,
  IDR: Schema.Int,
  USD: Schema.Int,
});
type SchoolPrices = typeof SchoolPrices.Type;

/** What one plan holds and what it costs a month. Storage is in megabytes, 1 GB being 1,000 MB. */
const SchoolTier = Schema.Struct({
  accounts: Schema.Int,
  credits: Schema.Int,
  creditsRenew: Schema.Boolean,
  monthly: SchoolPrices,
  storageMegabytes: Schema.Int,
});
type SchoolTier = typeof SchoolTier.Type;

/** The days of the free trial, with real data and every feature. */
export const SCHOOL_TRIAL_DAYS = 30;

/** The plans in order, with their accounts of every role, AI credits, Drive storage and monthly price. */
export const schoolTiers = {
  free: {
    accounts: 20,
    credits: 20,
    creditsRenew: false,
    monthly: { EUR: 0, IDR: 0, USD: 0 },
    storageMegabytes: 250,
  },
  pro: {
    accounts: 100,
    credits: 600,
    creditsRenew: true,
    monthly: { EUR: 10_900, IDR: 1_790_000, USD: 10_900 },
    storageMegabytes: 10_000,
  },
  max: {
    accounts: 500,
    credits: 3000,
    creditsRenew: true,
    monthly: { EUR: 49_900, IDR: 7_990_000, USD: 49_900 },
    storageMegabytes: 100_000,
  },
} as const satisfies Record<SchoolTierKey, SchoolTier>;

/** The discount of each billing period, in percent: a longer period pays less a month. */
export const schoolPeriodDiscounts = {
  1: 0,
  3: 0,
  6: 3,
  12: 5,
} as const satisfies Record<SchoolPeriod, number>;

/**
 * One account added to a paid plan, from one account up: its monthly price, and
 * the AI credits a month and Drive storage it brings. Its period discount follows
 * the plan, and it is billed on the plan's invoice.
 */
export const schoolAccount = {
  credits: 6,
  monthly: { EUR: 99, IDR: 15_900, USD: 99 },
  storageMegabytes: 200,
} as const satisfies {
  readonly credits: number;
  readonly monthly: SchoolPrices;
  readonly storageMegabytes: number;
};

/** The add-ons a school buys beside its plan. */
export const SchoolAddOnKey = Schema.Literals([
  "credits",
  "drive",
  "driveLarge",
]);
export type SchoolAddOnKey = typeof SchoolAddOnKey.Type;

/** One add-on: its price, whether it renews monthly, and what it adds. */
const SchoolAddOn = Schema.Struct({
  credits: Schema.Int,
  price: SchoolPrices,
  recurring: Schema.Boolean,
  storageMegabytes: Schema.Int,
});
type SchoolAddOn = typeof SchoolAddOn.Type;

/** The months that a bought pack of AI credits stays usable. */
export const SCHOOL_CREDIT_PACK_MONTHS = 12;

/**
 * The add-ons: a pack of 1,000 AI credits paid once, and Drive storage paid
 * monthly without a period discount.
 */
export const schoolAddOns = {
  credits: {
    credits: 1000,
    price: { EUR: 2400, IDR: 349_000, USD: 2400 },
    recurring: false,
    storageMegabytes: 0,
  },
  drive: {
    credits: 0,
    price: { EUR: 2900, IDR: 449_000, USD: 2900 },
    recurring: true,
    storageMegabytes: 100_000,
  },
  driveLarge: {
    credits: 0,
    price: { EUR: 24_900, IDR: 3_990_000, USD: 24_900 },
    recurring: true,
    storageMegabytes: 1_000_000,
  },
} as const satisfies Record<SchoolAddOnKey, SchoolAddOn>;

/** Rounds a hundredth of a minor unit to the nearest minor unit, a half up. */
function roundHundredths(hundredths: number) {
  return Math.floor((hundredths + 50) / 100);
}

/** A monthly amount after a period's discount, rounded to the minor unit. */
export function schoolMonthlyAfterDiscount(
  monthly: number,
  period: SchoolPeriod
) {
  return roundHundredths(monthly * (100 - schoolPeriodDiscounts[period]));
}

/** What a monthly amount costs for a whole period, paid in advance, rounded to the minor unit. */
export function schoolPeriodTotal(monthly: number, period: SchoolPeriod) {
  return roundHundredths(
    monthly * period * (100 - schoolPeriodDiscounts[period])
  );
}

/** The input of one quote: a paid plan, the accounts added to it, a period and a currency. */
export const SchoolQuoteInput = Schema.Struct({
  added: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: BillingCurrency,
  period: SchoolPeriod,
  tier: SchoolPaidTierKey,
});
export type SchoolQuoteInput = typeof SchoolQuoteInput.Type;

/**
 * What a paid plan with added accounts holds and costs for one period: its
 * accounts, AI credits a month and Drive storage, the monthly price before and
 * after the period's discount, and the invoice of the whole period.
 */
export function schoolQuote({
  added,
  currency,
  period,
  tier,
}: SchoolQuoteInput) {
  const plan = schoolTiers[tier];
  const monthly =
    plan.monthly[currency] + added * schoolAccount.monthly[currency];
  return {
    accounts: plan.accounts + added,
    credits: plan.credits + added * schoolAccount.credits,
    monthly,
    monthlyAfterDiscount: schoolMonthlyAfterDiscount(monthly, period),
    storageMegabytes:
      plan.storageMegabytes + added * schoolAccount.storageMegabytes,
    total: schoolPeriodTotal(monthly, period),
  };
}

/**
 * The paid plan that holds a number of accounts for the lowest monthly price,
 * with the accounts added to it: a school of 1,050 accounts pays less on Max with
 * 550 added than on Pro with 950. A number at or below a plan's own accounts adds
 * none.
 */
export function cheapestSchoolTier(
  accounts: number,
  currency: BillingCurrency
) {
  const quotes = Arr.map(SchoolPaidTierKey.literals, (tier) => {
    const added = Math.max(0, accounts - schoolTiers[tier].accounts);
    return {
      added,
      monthly: schoolQuote({ added, currency, period: 1, tier }).monthly,
      tier,
    };
  });
  return Arr.reduce(
    Arr.tailNonEmpty(quotes),
    Arr.headNonEmpty(quotes),
    (best, quote) => (quote.monthly < best.monthly ? quote : best)
  );
}
