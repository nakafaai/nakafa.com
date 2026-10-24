import {
  getPlanCreditConfig,
  NINA_RESPONSE_CREDITS,
} from "@repo/backend/confect/credits/constants";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Effect } from "effect";
import { createTranslator, type Locale } from "use-intl";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";
import { pricingFaqNumbers } from "@/lib/marketing/faq";
import { freePlanFeatures, proPlanFeatures } from "@/lib/marketing/plan";

/** Identifies the application-owned pricing document. */
export function isPricingLlmsRoute(cleanSlug: string) {
  return cleanSlug === "pricing";
}

/** Renders the localized pricing page as agent-readable Markdown. */
export const getPricingLlmsText = Effect.fn("www.llms.pricing.text")(function* (
  locale: Locale
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  const plans = createTranslator({ locale, messages, namespace: "Pricing" });
  const page = createTranslator({
    locale,
    messages,
    namespace: "PricingPage",
  });
  const landing = createTranslator({ locale, messages, namespace: "Landing" });
  const questions = Arr.join(
    Arr.map(
      pricingFaqNumbers,
      (number) =>
        `### ${page(`q${number}`)}\n\n${page(`a${number}`, { cost: NINA_RESPONSE_CREDITS })}`
    ),
    "\n\n"
  );
  const url = `${BASE_URL}/${locale}/pricing`;
  const credits = getPlanCreditConfig("pro").amount;

  return Arr.join(
    [
      ...buildHeader({
        description: page("metadata-description"),
        title: page("metadata-title"),
        url,
      }),
      `## ${landing("prices-title")}`,
      `## ${plans("free-title")}`,
      plans("free-description"),
      plans("free-worth-card"),
      plans("free-worth-trial"),
      ...Arr.map(freePlanFeatures, (key) => `- ${plans(key)}`),
      `## ${plans("pro-title")}`,
      plans("pro-description"),
      ...Arr.map(proPlanFeatures, (key) => `- ${plans(key, { credits })}`),
      page("checkout-line", { url }),
      `## ${landing("faq-title")}`,
      questions,
    ],
    "\n\n"
  );
});
