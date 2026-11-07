import {
  SchoolPaidTierKey,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr } from "effect";
import { PricingCurrencySchema } from "@/lib/pricing/monthly";
import { toMajorUnits } from "@/lib/pricing/school";

/** The name of each paid plan, which every language writes the same. */
const SCHOOL_PLAN_NAMES = { max: "Max", pro: "Pro" } as const;

/** The questions of the School landing, in the order it asks them: those no other part of the page answers. */
export const schoolLandingQuestions = [
  "accounts",
  "trial",
  "features",
  "languages",
  "devices",
] as const;

/** The questions of the School pricing page, in the order it asks them. */
export const schoolPricingQuestions = [
  "accounts",
  "added",
  "pay",
  "tax",
  "credits",
  "trial",
  "change",
] as const;

/**
 * The monthly price of each paid School plan in every currency, in major units,
 * as the structured data of both School pages states its offers.
 */
export const schoolProductOffers = Arr.map(
  SchoolPaidTierKey.literals,
  (tier) => ({
    name: `${COMPANY_IDENTITY.brandName} School ${SCHOOL_PLAN_NAMES[tier]}`,
    offers: Arr.map(PricingCurrencySchema.literals, (currency) => ({
      amount: toMajorUnits(currency, schoolTiers[tier].monthly[currency]),
      currency,
    })),
  })
);
