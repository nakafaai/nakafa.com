import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeBreadcrumbNodes,
  makeFaqPageNode,
  makeProductNode,
} from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion";
import { SchoolAddOns } from "@/components/marketing/school/addons";
import { SchoolCalculator } from "@/components/marketing/school/calculator";
import { SchoolCompare } from "@/components/marketing/school/compare";
import { SchoolFaq } from "@/components/marketing/school/faq";
import { SchoolPlans } from "@/components/marketing/school/plans";
import {
  SchoolPeriodProvider,
  SchoolPeriodSwitch,
} from "@/components/marketing/school/switch";
import { PageField } from "@/components/marketing/shared/field";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import type { MarketingFaqItem } from "@/lib/marketing/faq";
import {
  schoolPricingQuestions,
  schoolProductOffers,
} from "@/lib/marketing/school";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/**
 * The Nakafa School pricing page. The loader names the page's title and
 * description and reads its questions and breadcrumb labels, so the first HTML
 * and the head hold the same structured data: the breadcrumb, the questions, and
 * the offers of the paid plans in every currency.
 */
export const Route = createFileRoute("/$locale/_marketing/school/pricing")({
  loader: async ({ params }) => {
    const messages = await readStaticData(readRouteMessages, {
      locale: params.locale,
      namespaces: ["Common", "SchoolSite"],
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "SchoolSite",
    });
    const tCommon = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Common",
    });
    return {
      breadcrumb: {
        home: tCommon("home"),
        pricing: t("pricing-breadcrumb"),
        school: t("breadcrumb"),
      },
      description: t("pricing-metadata-description"),
      faqs: Arr.map(
        schoolPricingQuestions,
        (key): MarketingFaqItem => ({
          answer: t(`faq-${key}-answer`),
          question: t(`faq-${key}-question`),
        })
      ),
      title: t("pricing-metadata-title"),
    };
  },
  head: ({ loaderData, params }) => {
    if (loaderData === undefined) {
      return {};
    }
    const url = `${COMPANY_IDENTITY.url}/${params.locale}/school/pricing`;
    const image = getAppSocialArtwork({
      key: "home",
      locale: params.locale,
      publicPath: "school/pricing",
    });
    return {
      ...toRouterHead(
        createSeoHead({
          absoluteTitle: loaderData.title,
          canonicalPath: `/${params.locale}/school/pricing`,
          description: loaderData.description,
          image,
          indexable: true,
          jsonLd: [
            ...makeBreadcrumbNodes(
              createBreadcrumbItems(params.locale, [
                { name: loaderData.breadcrumb.home, path: "" },
                { name: loaderData.breadcrumb.school, path: "/school" },
                {
                  name: loaderData.breadcrumb.pricing,
                  path: "/school/pricing",
                },
              ])
            ),
            makeFaqPageNode({
              inLanguage: params.locale,
              items: loaderData.faqs,
              url,
            }),
            ...Arr.map(schoolProductOffers, (product) =>
              makeProductNode({
                description: loaderData.description,
                image: new URL(image, COMPANY_IDENTITY.url).href,
                name: product.name,
                offers: product.offers,
                url,
              })
            ),
          ],
          locale: params.locale,
          parts: [],
          type: "website",
        })
      ),
    };
  },
  component: SchoolPricing,
});

/** The title of the page, its period switch, the three plans, and the terms under them. */
function SchoolPricingPlans() {
  const t = useTranslations("SchoolSite");

  return (
    <section
      aria-labelledby="school-pricing-title"
      className="scroll-mt-28 px-6 pt-32 pb-12 lg:px-10 lg:pt-40"
      id="plans"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10">
        <div className="mx-auto grid max-w-2xl gap-3 text-center">
          <h1
            className="text-3xl tracking-tight text-balance sm:text-4xl"
            id="school-pricing-title"
          >
            {t("pricing-title")}
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">
            {t("pricing-lead")}
          </p>
        </div>
        <SchoolPeriodSwitch />
        <SchoolPlans />
        <div className="grid justify-items-center gap-1 text-center">
          <p className="text-muted-foreground text-sm text-pretty">
            {t("plan-upgrade-note")}
          </p>
          <p className="text-muted-foreground text-sm text-pretty">
            {t("tax-note")}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The calculator and the add-ons, one under the other, under the plans. */
function SchoolPricingExtras() {
  return (
    <section
      aria-labelledby="school-calculator-title"
      className="scroll-mt-28 px-6 py-12 lg:px-10"
      id="accounts"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-16">
        <SchoolCalculator />
        <SchoolAddOns />
      </div>
    </section>
  );
}

/** The School pricing page: plans by period, custom accounts, add-ons, the full comparison and questions. */
function SchoolPricing() {
  const { faqs } = Route.useLoaderData();

  return (
    <>
      <PageField />
      <SchoolPeriodProvider>
        <div className="relative grid grid-cols-1">
          <SchoolPricingPlans />
          <SchoolPricingExtras />
          <SchoolCompare />
          <SchoolFaq>
            <FaqAccordion faqs={faqs} openFirst />
          </SchoolFaq>
        </div>
      </SchoolPeriodProvider>
    </>
  );
}
