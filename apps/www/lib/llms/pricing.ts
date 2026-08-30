import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";

const FAQ_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const;

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
  const questions = FAQ_NUMBERS.map(
    (number) => `### ${page[`q${number}`]}\n\n${page[`a${number}`]}`
  ).join("\n\n");
  const url = `${BASE_URL}/${locale}/pricing`;

  return [
    ...buildHeader({
      description: page["metadata-description"],
      title: page["metadata-title"],
      url,
    }),
    `## ${pricing["free-title"]}`,
    pricing["free-description"],
    `- ${pricing["free-feature-1"]}`,
    `- ${pricing["free-feature-2"]}`,
    `- ${pricing["free-feature-3"]}`,
    `- ${pricing["free-feature-4"]}`,
    `- ${pricing["free-feature-5"]}`,
    `## ${pricing["pro-title"]}`,
    pricing["pro-description"],
    `- ${pricing["pro-feature-1"]}`,
    `- ${pricing["pro-feature-2"]}`,
    `- ${pricing["pro-feature-3"]}`,
    `- ${pricing["pro-feature-5"]}`,
    `Current price and checkout: ${url}`,
    `## ${page["faq-badge"]}`,
    questions,
  ].join("\n\n");
});
