import {
  SCHOOL_CREDIT_PACK_MONTHS,
  SCHOOL_TRIAL_DAYS,
  SchoolPaidTierKey,
  SchoolPeriod,
  schoolAccount,
  schoolAddOns,
  schoolPeriodDiscounts,
  schoolPeriodTotal,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Effect } from "effect";
import { createTranslator, type Locale } from "use-intl/core";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";
import {
  schoolLandingQuestions,
  schoolPricingQuestions,
} from "@/lib/marketing/school";
import type { PricingCurrencySchema } from "@/lib/pricing/monthly";
import { formatSchoolPrice, formatStorage } from "@/lib/pricing/school";

/** The School pages that answer with application-owned Markdown. */
const SCHOOL_LLMS_ROUTES = ["school", "school/pricing"] as const;

/** Identifies the application-owned School documents: the landing and its pricing. */
export function isSchoolLlmsRoute(cleanSlug: string) {
  return Arr.contains(SCHOOL_LLMS_ROUTES, cleanSlug);
}

/** Joins prices as alternatives, in the reader's language. */
const joinPrices = (locale: Locale, prices: readonly string[]) =>
  new Intl.ListFormat(locale, { type: "disjunction" }).format(prices);

/** One amount in every currency, rupiah first, as a price list states them. */
const everyCurrency = (
  locale: Locale,
  amountOf: (
    currency: (typeof PricingCurrencySchema.literals)[number]
  ) => number
) =>
  joinPrices(
    locale,
    Arr.map(["IDR", "USD", "EUR"] as const, (currency) =>
      formatSchoolPrice(currency, amountOf(currency))
    )
  );

/** Renders one School page, the landing or its pricing, as agent-readable Markdown. */
export const getSchoolLlmsText = Effect.fn("www.llms.school.text")(function* (
  locale: Locale,
  cleanSlug: string
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  const t = createTranslator({ locale, messages, namespace: "SchoolSite" });
  const pricing = cleanSlug === "school/pricing";
  const url = `${BASE_URL}/${locale}/${cleanSlug}`;
  const questions = pricing ? schoolPricingQuestions : schoolLandingQuestions;
  const plans = Arr.map(
    ["free", ...SchoolPaidTierKey.literals] as const,
    (tier) => {
      const plan = schoolTiers[tier];
      const price =
        tier === "free"
          ? t("plan-trial", { days: SCHOOL_TRIAL_DAYS })
          : `${everyCurrency(locale, (currency) => plan.monthly[currency])} ${t("plan-month")}`;
      return Arr.join(
        [
          `### ${t(`plan-${tier}`)}`,
          t(`plan-${tier}-description`),
          `- ${price}`,
          `- ${t("plan-accounts", { count: plan.accounts })}`,
          `- ${t(plan.creditsRenew ? "plan-credits-month" : "plan-credits-once", { count: plan.credits })}`,
          `- ${t("plan-storage", { size: formatStorage(plan.storageMegabytes, locale) })}`,
          `- ${t("plan-everything")}`,
        ],
        "\n"
      );
    }
  );
  const periods = Arr.map(SchoolPeriod.literals, (period) => {
    const discount = schoolPeriodDiscounts[period];
    const totals = Arr.map(
      SchoolPaidTierKey.literals,
      (tier) =>
        `${t(`plan-${tier}`)} ${everyCurrency(locale, (currency) => schoolPeriodTotal(schoolTiers[tier].monthly[currency], period))}`
    );
    return `- ${t("period-option", { months: period })}${discount > 0 ? ` (${t("period-save", { percent: discount })})` : ""}: ${Arr.join(totals, "; ")}`;
  });
  const features = Arr.map(
    [
      "forum",
      "library",
      "tasks",
      "exams",
      "reports",
      "insight",
      "graduation",
      "parents",
      "nina",
    ] as const,
    (key) => `- ${t(`feature-${key}-title`)}: ${t(`feature-${key}-text`)}`
  );
  const credits = schoolAddOns.credits;
  const pricingLines = [
    `## ${t("pricing-title")}`,
    t("pricing-lead"),
    ...plans,
    `## ${t("period-label")}`,
    ...periods,
    `## ${t("calculator-title")}`,
    `${everyCurrency(locale, (currency) => schoolAccount.monthly[currency])} ${t("calculator-unit")}. ${t("calculator-lead", { credits: schoolAccount.credits, size: formatStorage(schoolAccount.storageMegabytes, locale) })}`,
    `## ${t("addons-title")}`,
    `- ${t("addon-credits-title", { count: credits.credits })}: ${everyCurrency(locale, (currency) => credits.price[currency])} ${t("addon-once")}. ${t("addon-credits-text", { months: SCHOOL_CREDIT_PACK_MONTHS })}`,
    ...Arr.map(["drive", "driveLarge"] as const, (key) => {
      const addOn = schoolAddOns[key];
      return `- ${t("addon-drive-title", { size: formatStorage(addOn.storageMegabytes, locale) })}: ${everyCurrency(locale, (currency) => addOn.price[currency])} ${t("plan-month")}. ${t("addon-drive-text")}`;
    }),
    t("tax-note"),
  ];

  return Arr.join(
    [
      ...buildHeader({
        description: t(
          pricing ? "pricing-metadata-description" : "metadata-description"
        ),
        title: t(pricing ? "pricing-metadata-title" : "metadata-title"),
        url,
      }),
      ...(pricing
        ? pricingLines
        : [
            t("hero-lead"),
            `## ${t("features-title")}`,
            ...features,
            ...pricingLines,
            `[${t("hero-start")}](${BASE_URL}/${locale}/school/new)`,
          ]),
      `## ${t("faq-title")}`,
      ...Arr.map(
        questions,
        (key) => `### ${t(`faq-${key}-question`)}\n\n${t(`faq-${key}-answer`)}`
      ),
    ],
    "\n\n"
  );
});
