import { NINA_RESPONSE_CREDITS } from "@repo/backend/confect/credits/constants";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { makeBreadcrumbNodes, makeFaqPageNode } from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { Faq } from "@/components/marketing/about/faq/landing";
import { PricingButton } from "@/components/marketing/about/pricing/button";
import { PricingComparison } from "@/components/marketing/about/pricing/comparison";
import { DeferredPricingToys } from "@/components/marketing/about/pricing/deferred";
import { PricingCards } from "@/components/marketing/about/pricing/plans";
import { StaticPrice } from "@/components/marketing/about/pricing/price";
import { Schools } from "@/components/marketing/about/schools";
import { PRICING_CLASS_HERD } from "@/components/marketing/about/toys/herd";
import { PageField } from "@/components/marketing/shared/field";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { type MarketingFaqItem, pricingFaqNumbers } from "@/lib/marketing/faq";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/**
 * The pricing page. The loader names the page's title and description, carries
 * the price text of all three currencies, and reads the questions and the
 * breadcrumb labels, so the first HTML and the head hold the same structured data.
 */
export const Route = createFileRoute("/$locale/_marketing/pricing")({
  loader: async ({ params }) => {
    const messages = await readStaticData(readRouteMessages, {
      locale: params.locale,
      namespaces: ["Common", "PricingPage"],
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "PricingPage",
    });
    const tCommon = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Common",
    });
    return {
      breadcrumb: {
        home: tCommon("home"),
        pricing: t("breadcrumb"),
      },
      description: t("metadata-description"),
      faqs: Arr.map(
        pricingFaqNumbers,
        (number): MarketingFaqItem => ({
          answer: t(`a${number}`, { cost: NINA_RESPONSE_CREDITS }),
          question: t(`q${number}`),
        })
      ),
      title: t("metadata-title"),
    };
  },
  head: ({ loaderData, params }) => {
    if (loaderData === undefined) {
      return {};
    }
    const url = `${COMPANY_IDENTITY.url}/${params.locale}/pricing`;
    return {
      ...toRouterHead(
        createSeoHead({
          absoluteTitle: loaderData.title,
          canonicalPath: `/${params.locale}/pricing`,
          description: loaderData.description,
          image: getAppSocialArtwork({
            key: "pricing",
            locale: params.locale,
            publicPath: "pricing",
          }),
          indexable: true,
          jsonLd: [
            ...makeBreadcrumbNodes(
              createBreadcrumbItems(params.locale, [
                { name: loaderData.breadcrumb.home, path: "" },
                { name: loaderData.breadcrumb.pricing, path: "/pricing" },
              ])
            ),
            makeFaqPageNode({
              inLanguage: params.locale,
              items: loaderData.faqs,
              url,
            }),
          ],
          locale: params.locale,
          parts: [],
          type: "website",
        })
      ),
    };
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
  const { faqs } = Route.useLoaderData();

  return (
    <>
      <PageField />
      <div className="relative grid">
        <PricingPagePlans />
        <DeferredPricingToys />
        <PricingComparison />
        <Schools herd={PRICING_CLASS_HERD} />
        <Faq faqs={faqs} />
      </div>
    </>
  );
}
