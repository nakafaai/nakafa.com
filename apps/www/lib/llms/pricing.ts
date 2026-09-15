import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";
import { pricingFaqNumbers } from "@/lib/marketing/faq";
import { freePlanFeatures, proPlanFeatures } from "@/lib/marketing/plan";

/** Removes the reviewed emphasis tag from a heading used outside rich text. */
function getPlainHeading(heading: string) {
  return heading.replaceAll("<mark>", "").replaceAll("</mark>", "");
}

/** Identifies the application-owned pricing document. */
export function isPricingLlmsRoute(cleanSlug: string) {
  return cleanSlug === "pricing";
}

/** Renders the localized pricing page as agent-readable Markdown. */
export const getPricingLlmsText = Effect.fn("www.llms.pricing.text")(function* (
  locale: Locale
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  const pricing = messages.Pricing;
  const page = messages.PricingPage;
  const questions = pricingFaqNumbers
    .map((number) => `### ${page[`q${number}`]}\n\n${page[`a${number}`]}`)
    .join("\n\n");
  const url = `${BASE_URL}/${locale}/pricing`;

  return [
    ...buildHeader({
      description: page["metadata-description"],
      title: page["metadata-title"],
      url,
    }),
    `## ${getPlainHeading(page.headline)}`,
    page.description,
    `## ${pricing["free-title"]}`,
    pricing["free-description"],
    ...freePlanFeatures.map((key) => `- ${pricing[key]}`),
    `## ${pricing["pro-title"]}`,
    pricing["pro-description"],
    ...proPlanFeatures.map((key) => `- ${pricing[key]}`),
    `Current price and checkout: ${url}`,
    `## ${getPlainHeading(page["faq-headline"])}`,
    questions,
  ].join("\n\n");
});
