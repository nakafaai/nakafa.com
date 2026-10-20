import { NINA_RESPONSE_CREDITS } from "@repo/backend/confect/credits/constants";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { FAQPageJsonLd } from "@repo/seo/json-ld/faq-page";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { createTranslator, useTranslations } from "use-intl";
import { Faq } from "@/components/marketing/about/faq/landing";
import { PricingButton } from "@/components/marketing/about/pricing/button.client";
import { PricingComparison } from "@/components/marketing/about/pricing/comparison";
import { DeferredPricingToys } from "@/components/marketing/about/pricing/deferred.client";
import { PricingCards } from "@/components/marketing/about/pricing/plans";
import { StaticPrice } from "@/components/marketing/about/pricing/price";
import { Schools } from "@/components/marketing/about/schools";
import { PRICING_CLASS_HERD } from "@/components/marketing/about/toys/herd";
import { PageField } from "@/components/marketing/shared/field.client";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { type MarketingFaqItem, pricingFaqNumbers } from "@/lib/marketing/faq";
import { getAppSocialArtwork } from "@/lib/og/app";
import { pricingCurrencyScript } from "@/lib/pricing/currency";
import { getProMonthlyPriceTexts } from "@/lib/pricing/monthly";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/**
 * The pricing page. The loader names the page's title and description, and
 * carries the price text of all three currencies, so the first HTML holds each
 * of them and the head script keeps the one the visitor sees.
 */
export const Route = createFileRoute("/$locale/_marketing/pricing")({
  loader: async ({ params }) => {
    const messages = await readRouteMessages({
      data: { locale: params.locale, namespaces: ["PricingPage"] },
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "PricingPage",
    });
    return {
      description: t("metadata-description"),
      prices: getProMonthlyPriceTexts(),
      title: t("metadata-title"),
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : {
          ...toRouterHead(
            createSeoHead({
              canonicalPath: `/${params.locale}/pricing`,
              description: loaderData.description,
              image: getAppSocialArtwork({
                key: "pricing",
                locale: params.locale,
                publicPath: "pricing",
              }),
              indexable: true,
              jsonLd: [],
              locale: params.locale,
              parts: [loaderData.title],
              type: "website",
            })
          ),
          scripts: [{ children: pricingCurrencyScript() }],
        },
  component: PricingPage,
});

/** The headline above the two plans. */
function PricingPagePlans() {
  const t = useTranslations("Landing");
  return (
    <section
      aria-labelledby="pricing-heading"
      className="scroll-mt-28 px-6 pt-32 pb-20 lg:px-10 lg:pt-40 lg:pb-32"
      id="plans"
    >
      <div className="mx-auto w-full max-w-7xl">
        <h1
          className="text-balance text-center text-3xl tracking-tight sm:text-4xl"
          id="pricing-heading"
        >
          {t("prices-title")}
        </h1>
        <PricingCards
          headingLevel="h2"
          Price={StaticPrice}
          proAction={<PricingButton variant="default" />}
        />
      </div>
    </section>
  );
}

/** The pricing page: its plans, comparison, schools and questions. */
function PricingPage() {
  const { locale } = Route.useParams();
  const tCommon = useTranslations("Common");
  const tPricingPage = useTranslations("PricingPage");
  const faqItems: MarketingFaqItem[] = Arr.map(pricingFaqNumbers, (number) => ({
    answer: tPricingPage(`a${number}`, { cost: NINA_RESPONSE_CREDITS }),
    question: tPricingPage(`q${number}`),
  }));
  const url = `${COMPANY_IDENTITY.url}/${locale}/pricing`;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tPricingPage("breadcrumb"), path: "/pricing" },
        ])}
      />
      <FAQPageJsonLd
        inLanguage={locale}
        mainEntity={Arr.map(faqItems, (item) => ({
          acceptedAnswer: { "@type": "Answer", text: item.answer },
          name: item.question,
        }))}
        url={url}
      />
      <PageField />
      <div className="relative grid">
        <PricingPagePlans />
        <DeferredPricingToys />
        <PricingComparison />
        <Schools herd={PRICING_CLASS_HERD} />
        <Faq faqs={faqItems} />
      </div>
    </>
  );
}
