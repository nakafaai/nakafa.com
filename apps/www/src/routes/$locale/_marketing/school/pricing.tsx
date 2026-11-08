import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeBreadcrumbNodes,
  makeFaqPageNode,
  makeProductNode,
} from "@repo/seo/jsonld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion";
import { DeferredSchoolToys } from "@/components/marketing/school/deferred";
import {
  openSchoolPricing,
  schoolSections,
} from "@/components/marketing/school/later";
import { SchoolPlans } from "@/components/marketing/school/pricing/plans";
import { PageField } from "@/components/marketing/shared/field";
import { LaterSection } from "@/components/marketing/shared/later";
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
  // A warm of a link to this page is a preload: it takes the page's code and data, never the sections a reader
  // reaches by scrolling, which a navigation opens here before the page commits.
  beforeLoad: async ({ preload }) => {
    if (!preload) {
      await openSchoolPricing();
    }
  },
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

/** The title of the page, the three plans, and the tax line under them. */
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
        <SchoolPlans />
        <p className="text-muted-foreground text-center text-sm text-pretty">
          {t("tax-note")}
        </p>
      </div>
    </section>
  );
}

/**
 * The School pricing page: the plans, the full comparison straight under them,
 * the account calculator and the add-ons, the questions, and the closing
 * question. Everything after the plans loads its code as it nears, and the toys
 * come on a wide screen once the page has its reader.
 */
function SchoolPricing() {
  const { faqs } = Route.useLoaderData();

  return (
    <>
      <PageField />
      <div className="relative grid grid-cols-1">
        <SchoolPricingPlans />
        <DeferredSchoolToys page="pricing" />
        <LaterSection code={schoolSections.compare}>
          {(SchoolCompare) => <SchoolCompare />}
        </LaterSection>
        <LaterSection code={schoolSections.calculator}>
          {(SchoolCalculator) => <SchoolCalculator />}
        </LaterSection>
        <LaterSection code={schoolSections.addons}>
          {(SchoolAddOns) => <SchoolAddOns />}
        </LaterSection>
        <LaterSection code={schoolSections.faq}>
          {(SchoolFaq) => (
            <SchoolFaq>
              <FaqAccordion faqs={faqs} openFirst />
            </SchoolFaq>
          )}
        </LaterSection>
        <LaterSection code={schoolSections.closing}>
          {(SchoolClosing) => <SchoolClosing />}
        </LaterSection>
      </div>
    </>
  );
}
