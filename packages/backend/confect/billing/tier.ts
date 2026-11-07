/**
 * The plans Nakafa School sells, as the owner priced them on 2 November 2026:
 * what each plan holds, what it costs in each currency, how long a school may
 * pay for at once, and the add-ons. Every price is before the customer's tax and
 * in the currency's minor unit (rupiah, cents). Browser code imports this module,
 * the School billing page and the public pricing page alike, so it reads no
 * secret and no server setting.
 */
import { Array as Arr, Schema } from "effect";

/** Every School plan. A school starts on the trial and pays for Pro or Max. */
export const SchoolPlan = Schema.Literals(["trial", "pro", "max"]);
export type SchoolPlan = typeof SchoolPlan.Type;

/** The plans a school pays for. */
export const PaidSchoolPlan = Schema.Literals(["pro", "max"]);
export type PaidSchoolPlan = typeof PaidSchoolPlan.Type;

/** The months a school may pay for at once. */
export const SchoolMonths = Schema.Literals([1, 3, 6, 12]);
export type SchoolMonths = typeof SchoolMonths.Type;

/** The days the trial runs, with every feature and the school's real data. */
export const SCHOOL_TRIAL_DAYS = 30;

const MEGABYTE = 1_000_000;

/** What a plan lets a school hold: accounts, AI credits, and Drive bytes. */
export const SchoolQuota = Schema.Struct({
  accounts: Schema.Int,
  credits: Schema.Int,
  driveBytes: Schema.Int,
});
const GIGABYTE = 1000 * MEGABYTE;

/**
 * What each plan holds. Every role counts as an account, and one person who
 * holds several roles is one account. `credits` are the AI credits the school
 * shares each month; the trial grants its credits once. `driveBytes` is the
 * Drive the whole school shares.
 */
export const schoolPlans = {
  trial: { accounts: 20, credits: 20, driveBytes: 250 * MEGABYTE },
  pro: { accounts: 100, credits: 600, driveBytes: 10 * GIGABYTE },
  max: { accounts: 500, credits: 3000, driveBytes: 100 * GIGABYTE },
} as const satisfies Record<SchoolPlan, typeof SchoolQuota.Type>;

/**
 * The monthly price of each paid plan, and of one account a school adds to its
 * plan, in each currency's minor unit. USD and EUR are fixed prices, never a
 * conversion at checkout.
 */
export const schoolMonthlyPrices = {
  pro: { EUR: 10_900, IDR: 1_790_000, USD: 10_900 },
  max: { EUR: 49_900, IDR: 7_990_000, USD: 49_900 },
  account: { EUR: 99, IDR: 15_900, USD: 99 },
} as const;

/** What one added account brings with it each month: AI credits and Drive. */
export const schoolAccountGrant = { credits: 6, driveBytes: 200 * MEGABYTE };

/**
 * The discount of each period in basis points, for the plan and its added
 * accounts alike: none for one or three months, 3% for six, 5% for twelve.
 */
export const schoolDiscounts = {
  1: 0,
  3: 0,
  6: 300,
  12: 500,
} as const satisfies Record<SchoolMonths, number>;

/** The presets the account field offers. A school may add any whole number of accounts from one. */
export const SCHOOL_ACCOUNT_PRESETS = [1, 10, 50, 100] as const;

/** The most accounts a school adds in one invoice. A larger school signs a contract. */
export const SCHOOL_ACCOUNT_LIMIT = 100_000;

/**
 * The add-ons a school buys beside its plan, in each currency's minor unit. AI
 * credits are bought once and last 12 months; Drive renews monthly and takes no
 * period discount.
 */
export const schoolAddOnPrices = {
  credits: { EUR: 2400, IDR: 349_000, USD: 2400 },
  drive100: { EUR: 2900, IDR: 449_000, USD: 2900 },
  drive1000: { EUR: 24_900, IDR: 3_990_000, USD: 24_900 },
} as const;

/** What each add-on adds: 1,000 AI credits for 12 months, or 100 GB or 1 TB of Drive a month. */
export const schoolAddOns = {
  credits: { credits: 1000, months: 12 },
  drive100: { driveBytes: 100 * GIGABYTE },
  drive1000: { driveBytes: 1000 * GIGABYTE },
} as const;

/** The key an invoice line names: a paid plan, or the accounts added to one. */
export const SchoolLineKey = Schema.Literals([
  "school.pro",
  "school.max",
  "school.accounts",
]);
export type SchoolLineKey = typeof SchoolLineKey.Type;

/** The line key of each paid plan. */
export const schoolPlanLines = {
  pro: "school.pro",
  max: "school.max",
} as const satisfies Record<PaidSchoolPlan, SchoolLineKey>;

/** The accounts each kind of line pays for, per unit of its quantity. */
const LINE_ACCOUNTS = {
  "school.pro": schoolPlans.pro.accounts,
  "school.max": schoolPlans.max.accounts,
  "school.accounts": 1,
} as const satisfies Record<SchoolLineKey, number>;

const isSchoolLine = Schema.is(SchoolLineKey);

/**
 * The accounts one invoice line pays for: the accounts of its plan for a plan
 * line, one for each added account, and none for a line an operator wrote.
 */
export function lineAccounts(description: string, quantity: number) {
  return isSchoolLine(description)
    ? LINE_ACCOUNTS[description] * quantity
    : 0;
}

/** The paid plan an invoice line sells, when it sells one. */
export function linePlan(description: string) {
  return Arr.findFirst(
    PaidSchoolPlan.literals,
    (plan) => schoolPlanLines[plan] === description
  );
}
