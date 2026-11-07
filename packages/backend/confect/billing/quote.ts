/**
 * The price math of a School invoice: a paid plan with the accounts a school
 * adds to it for a period, or accounts added to the plan that runs, for the share
 * of its days still to run. Every amount is exact until one rounding per line,
 * half away from zero to the currency's minor unit, so a foreign price loses at
 * most one cent on the invoice total. The School billing page quotes with the
 * same functions the server issues the invoice with, so both show one number.
 */
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  PaidSchoolPlan,
  SCHOOL_ACCOUNT_LIMIT,
  type SchoolMonths,
  SchoolMonths as SchoolMonthsSchema,
  schoolDiscounts,
  schoolMonthlyPrices,
  schoolPlanLines,
} from "@repo/backend/confect/billing/tier";
import {
  Array as Arr,
  BigDecimal,
  DateTime,
  Duration,
  Option,
  Schema,
} from "effect";

const DAY_MS = Duration.toMillis(Duration.days(1));

/** The basis points a discount is written in. */
const BASIS = 10_000;

/** One period of a plan: when it starts, when it ends, and the months it runs. */
export const SchoolPeriod = Schema.Struct({
  end: Schema.Finite,
  months: SchoolMonthsSchema,
  start: Schema.Finite,
});
type SchoolPeriod = typeof SchoolPeriod.Type;

/** The share of a period an amount pays for: `left` of its `days`. */
const Share = Schema.Struct({ days: Schema.Int, left: Schema.Int });
type Share = typeof Share.Type;

/** What one priced item costs a month: a paid plan, or one added account. */
type PricedItem = keyof typeof schoolMonthlyPrices;

/** The period of `months` months that starts at `start`, by the calendar in UTC. */
export function schoolPeriod(start: number, months: SchoolMonths): SchoolPeriod {
  const end = DateTime.toEpochMillis(
    DateTime.add(DateTime.makeUnsafe(start), { months })
  );
  return { end, months, start };
}

/** The months a period runs, when it is one a school can pay for. */
export function periodMonths(start: number, end: number) {
  return Arr.findFirst(
    SchoolMonthsSchema.literals,
    (months) => schoolPeriod(start, months).end === end
  );
}

/**
 * What `quantity` of one item costs for `months` months after the period's
 * discount, for `left` of the period's `days`, rounded once.
 */
function amountOf(
  item: PricedItem,
  currency: BillingCurrency,
  months: SchoolMonths,
  quantity: number,
  share: Share
) {
  const exact = BigDecimal.divideUnsafe(
    BigDecimal.multiplyAll([
      BigDecimal.fromBigInt(
        BigInt(schoolMonthlyPrices[item][currency] * months * quantity)
      ),
      BigDecimal.make(BigInt(BASIS - schoolDiscounts[months]), 4),
      BigDecimal.fromBigInt(BigInt(share.left)),
    ]),
    BigDecimal.fromBigInt(BigInt(share.days))
  );
  return BigDecimal.toNumberUnsafe(BigDecimal.round(exact));
}

/** The accounts a school adds in one order: none, or any whole number up to the limit. */
export const AddedAccounts = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: SCHOOL_ACCOUNT_LIMIT })
);

/** A paid plan with the accounts added to it, for a whole period, in one currency. */
export const PlanOrder = Schema.Struct({
  accounts: AddedAccounts,
  currency: BillingCurrency,
  months: SchoolMonthsSchema,
  plan: PaidSchoolPlan,
});

/** Accounts added to the plan that runs over `period`, from `from` to its end, in one currency. */
export const AccountsOrder = Schema.Struct({
  accounts: AddedAccounts,
  currency: BillingCurrency,
  from: Schema.Finite,
  period: SchoolPeriod,
});

/** The whole of a period, for an item bought from its start. */
const WHOLE: Share = { days: 1, left: 1 };

/** What one item costs for a period after its discount: the price a pricing table shows. */
export function schoolPeriodPrice(
  item: PricedItem,
  months: SchoolMonths,
  currency: BillingCurrency
) {
  return amountOf(item, currency, months, 1, WHOLE);
}

/**
 * The whole days of a period still to run from `from`, over its whole days. A
 * moment at or before the start leaves the whole period.
 */
export function remainingShare(period: SchoolPeriod, from: number) {
  return {
    days: Math.ceil((period.end - period.start) / DAY_MS),
    left: Math.ceil((period.end - Math.max(from, period.start)) / DAY_MS),
  };
}

/** One invoice line: what it sells, how many, the price of one, and the line's amount. */
function lineOf(
  description: string,
  quantity: number,
  unitAmount: number,
  amount: number
) {
  return { amount, description, quantity, unitAmount };
}

/** The lines of a quote, and their total. */
function quoteOf(lines: readonly ReturnType<typeof lineOf>[]) {
  return {
    lines,
    total: Arr.reduce(lines, 0, (total, line) => total + line.amount),
  };
}

/** The accounts line of a quote, when it adds any. */
function accountsLine(
  currency: BillingCurrency,
  months: SchoolMonths,
  accounts: number,
  share: Share
) {
  return Option.liftPredicate(accounts, (count) => count > 0).pipe(
    Option.map((count) =>
      lineOf(
        "school.accounts",
        count,
        amountOf("account", currency, months, 1, share),
        amountOf("account", currency, months, count, share)
      )
    )
  );
}

/**
 * What a school pays for a paid plan and `accounts` added accounts over a
 * whole period of `months` months: the plan's line, then the accounts' line when
 * it adds any, both after the period's discount.
 */
export function planQuote(input: typeof PlanOrder.Type) {
  const price = schoolPeriodPrice(input.plan, input.months, input.currency);
  return quoteOf([
    lineOf(schoolPlanLines[input.plan], 1, price, price),
    ...Option.toArray(
      accountsLine(input.currency, input.months, input.accounts, WHOLE)
    ),
  ]);
}

/**
 * What a school pays to add `accounts` accounts to the plan that runs over
 * `period`, from `from` to its end: the period's price of each account after
 * its discount, for the share of its days still to run.
 */
export function accountsQuote(input: typeof AccountsOrder.Type) {
  return quoteOf(
    Option.toArray(
      accountsLine(
        input.currency,
        input.period.months,
        input.accounts,
        remainingShare(input.period, input.from)
      )
    )
  );
}
