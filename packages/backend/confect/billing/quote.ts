/**
 * The invoice math of School: a paid plan with the accounts a school adds to it
 * for a period, or accounts added to the plan that runs, for the share of its days
 * still to run. Every price comes from `billing/tiers.ts`. Every amount is exact
 * until one rounding per line, half away from zero to the currency's minor unit,
 * so a foreign price loses at most one cent on the invoice total. The School
 * billing page quotes with the same functions the server issues the invoice with,
 * so both show one number. Browser code imports this module.
 */
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  SchoolPaidTierKey,
  SchoolPeriod,
  schoolAccount,
  schoolPeriodDiscounts,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import { Array as Arr, BigDecimal, DateTime, Duration, Schema } from "effect";

const DAY_MS = Duration.toMillis(Duration.days(1));

/** The presets the account field offers. A school may add any whole number of accounts from one. */
export const SCHOOL_ACCOUNT_PRESETS = [1, 10, 50, 100] as const;

/** The most accounts a school adds in one invoice. A larger school signs a contract. */
export const SCHOOL_ACCOUNT_LIMIT = 100_000;

/** The key an invoice line names: a paid plan, or the accounts added to one. */
export const SchoolLineKey = Schema.Literals([
  "school.pro",
  "school.max",
  "school.accounts",
]);
export type SchoolLineKey = typeof SchoolLineKey.Type;

/** The line key of each paid plan. */
const schoolPlanLines = {
  pro: "school.pro",
  max: "school.max",
} as const satisfies Record<SchoolPaidTierKey, SchoolLineKey>;

/** The accounts each kind of line pays for, per unit of its quantity. */
const LINE_ACCOUNTS = {
  "school.pro": schoolTiers.pro.accounts,
  "school.max": schoolTiers.max.accounts,
  "school.accounts": 1,
} as const satisfies Record<SchoolLineKey, number>;

const isSchoolLine = Schema.is(SchoolLineKey);

/**
 * The accounts one invoice line pays for: the accounts of its plan for a plan
 * line, and one for each unit of an added accounts line or of a line an operator
 * wrote, which bills the seats of an Enterprise contract.
 */
export function lineAccounts(description: string, quantity: number) {
  return isSchoolLine(description)
    ? LINE_ACCOUNTS[description] * quantity
    : quantity;
}

/** The paid plan an invoice line sells, when it sells one. */
export function linePlan(description: string) {
  return Arr.findFirst(
    SchoolPaidTierKey.literals,
    (plan) => schoolPlanLines[plan] === description
  );
}

/** What a school's billing says of its accounts: the plan it is on, and the accounts it holds against its limit. */
const AccountState = Schema.Struct({
  accounts: Schema.Struct({ limit: Schema.Int, used: Schema.Int }),
  plan: Schema.Struct({ kind: Schema.String }),
});

/**
 * The accounts a school holds that nothing pays for yet: every account on the
 * trial, and those past what its running grants pay for otherwise. A school
 * outside Indonesia buys one Polar seat for each.
 */
export function unpaidAccounts(billing: typeof AccountState.Type) {
  const paid = billing.plan.kind === "trial" ? 0 : billing.accounts.limit;
  return Math.max(billing.accounts.used - paid, 0);
}

/** One period of a plan: when it starts, when it ends, and the months it runs. */
export const PlanPeriod = Schema.Struct({
  end: Schema.Finite,
  months: SchoolPeriod,
  start: Schema.Finite,
});
type PlanPeriod = typeof PlanPeriod.Type;

/** The share of a period an amount pays for: `left` of its `days`. */
const Share = Schema.Struct({ days: Schema.Int, left: Schema.Int });
type Share = typeof Share.Type;

/** What a school pays a monthly price for: a paid plan, or one added account. */
const PricedItem = Schema.Literals(["pro", "max", "account"]);
type PricedItem = typeof PricedItem.Type;

/** The period of `months` months that starts at `start`, by the calendar in UTC. */
export function schoolPeriod(start: number, months: SchoolPeriod): PlanPeriod {
  const end = DateTime.toEpochMillis(
    DateTime.add(DateTime.makeUnsafe(start), { months })
  );
  return { end, months, start };
}

/** The months a period runs, when it is one a school can pay for. */
export function periodMonths(start: number, end: number) {
  return Arr.findFirst(
    SchoolPeriod.literals,
    (months) => schoolPeriod(start, months).end === end
  );
}

/** The monthly price of each priced item in each currency. */
const MONTHLY = {
  account: schoolAccount.monthly,
  max: schoolTiers.max.monthly,
  pro: schoolTiers.pro.monthly,
} as const satisfies Record<PricedItem, unknown>;

/**
 * What `quantity` of one item costs for `months` months after the period's
 * discount, for `left` of the period's `days`, rounded once.
 */
function amountOf(
  item: PricedItem,
  currency: BillingCurrency,
  months: SchoolPeriod,
  quantity: number,
  share: Share
) {
  const exact = BigDecimal.divideUnsafe(
    BigDecimal.multiplyAll([
      BigDecimal.fromBigInt(
        BigInt(MONTHLY[item][currency] * months * quantity)
      ),
      BigDecimal.make(BigInt(100 - schoolPeriodDiscounts[months]), 2),
      BigDecimal.fromBigInt(BigInt(share.left)),
    ]),
    BigDecimal.fromBigInt(BigInt(share.days))
  );
  return BigDecimal.toNumberUnsafe(BigDecimal.round(exact));
}

/** The accounts a school adds with a plan: none, or any whole number up to the limit. */
const AddedAccounts = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: SCHOOL_ACCOUNT_LIMIT })
);

/** The accounts a school adds to the plan that runs: any whole number from one up to the limit. */
const MoreAccounts = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: SCHOOL_ACCOUNT_LIMIT })
);

/** A paid plan with the accounts added to it, for a whole period, in one currency. */
const PlanOrder = Schema.Struct({
  accounts: AddedAccounts,
  currency: BillingCurrency,
  months: SchoolPeriod,
  plan: SchoolPaidTierKey,
});

/** Accounts added to the plan that runs over `period`, from `from` to its end, in one currency. */
const AccountsOrder = Schema.Struct({
  accounts: MoreAccounts,
  currency: BillingCurrency,
  from: Schema.Finite,
  period: PlanPeriod,
});

/**
 * What a school orders from its billing page: a paid plan for a period with the
 * accounts it adds, which starts when the running plan ends; or more accounts for
 * the plan that runs, until its end. The server prices either from the school's
 * own currency and plan, never from the page.
 */
export const SchoolOrder = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("plan"),
    accounts: AddedAccounts,
    months: SchoolPeriod,
    plan: SchoolPaidTierKey,
  }),
  Schema.Struct({ kind: Schema.Literal("accounts"), accounts: MoreAccounts }),
]).pipe(Schema.toTaggedUnion("kind"));
export type SchoolOrder = typeof SchoolOrder.Type;

/** The whole of a period, for an item bought from its start. */
const WHOLE: Share = { days: 1, left: 1 };

/** What one item costs for a period after its discount: the price a pricing table shows. */
export function schoolPeriodPrice(
  item: PricedItem,
  months: SchoolPeriod,
  currency: BillingCurrency
) {
  return amountOf(item, currency, months, 1, WHOLE);
}

/**
 * The whole days of a period still to run from `from`, over its whole days. A
 * moment at or before the start leaves the whole period.
 */
export function remainingShare(period: PlanPeriod, from: number) {
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
function quoteOf(lines: Arr.NonEmptyReadonlyArray<ReturnType<typeof lineOf>>) {
  return {
    lines,
    total: Arr.reduce(lines, 0, (total, line) => total + line.amount),
  };
}

/** The line of `accounts` added accounts for a share of a period of `months` months. */
function accountsLine(
  currency: BillingCurrency,
  months: SchoolPeriod,
  accounts: number,
  share: Share
) {
  return lineOf(
    "school.accounts",
    accounts,
    amountOf("account", currency, months, 1, share),
    amountOf("account", currency, months, accounts, share)
  );
}

/**
 * What a school pays for a paid plan and `accounts` added accounts over a
 * whole period of `months` months: the plan's line, then the accounts' line when
 * it adds any, both after the period's discount.
 */
export function planQuote(input: typeof PlanOrder.Type) {
  const price = schoolPeriodPrice(input.plan, input.months, input.currency);
  const plan = lineOf(schoolPlanLines[input.plan], 1, price, price);
  return quoteOf(
    input.accounts > 0
      ? [
          plan,
          accountsLine(input.currency, input.months, input.accounts, WHOLE),
        ]
      : [plan]
  );
}

/**
 * What a school pays to add `accounts` accounts to the plan that runs over
 * `period`, from `from` to its end: the period's price of each account after
 * its discount, for the share of its days still to run.
 */
export function accountsQuote(input: typeof AccountsOrder.Type) {
  return quoteOf([
    accountsLine(
      input.currency,
      input.period.months,
      input.accounts,
      remainingShare(input.period, input.from)
    ),
  ]);
}
