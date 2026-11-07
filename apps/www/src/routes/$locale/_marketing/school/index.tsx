import { buttonVariants } from "@repo/design-system/lib/button";
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
import { SchoolClosing } from "@/components/marketing/school/closing";
import { SchoolFaq } from "@/components/marketing/school/faq";
import { SchoolFeatures } from "@/components/marketing/school/features";
import { SchoolHero } from "@/components/marketing/school/hero";
import { SchoolPlans } from "@/components/marketing/school/plans";
import { SchoolProof } from "@/components/marketing/school/proof";
import { SchoolSteps } from "@/components/marketing/school/steps";
import { SchoolPeriodProvider } from "@/components/marketing/school/switch";
import { PageField } from "@/components/marketing/shared/field";
import { MarketingSection } from "@/components/marketing/shared/section";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import type { MarketingFaqItem } from "@/lib/marketing/faq";
import {
  schoolLandingQuestions,
  schoolProductOffers,
} from "@/lib/marketing/school";
import { getAppSocialArtwork } from "@/lib/og/app";
import { Link } from "@/lib/routing/link";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/**
 * The Nakafa School landing. The loader names the page's title and description
 * and reads its questions and breadcrumb labels, so the first HTML and the head
 * hold the same structured data: the breadcrumb, the questions, and the offers
 * of the paid plans.
 */
export const Route = createFileRoute("/$locale/_marketing/school/")({
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
      breadcrumb: { home: tCommon("home"), school: t("breadcrumb") },
      description: t("metadata-description"),
      faqs: Arr.map(
        schoolLandingQuestions,
        (key): MarketingFaqItem => ({
          answer: t(`faq-${key}-answer`),
          question: t(`faq-${key}-question`),
        })
      ),
      title: t("metadata-title"),
    };
  },
  head: ({ loaderData, params }) => {
    if (loaderData === undefined) {
      return {};
    }
    const url = `${COMPANY_IDENTITY.url}/${params.locale}/school`;
    const image = getAppSocialArtwork({
      key: "home",
      locale: params.locale,
      publicPath: "school",
    });
    return {
      ...toRouterHead(
        createSeoHead({
          absoluteTitle: loaderData.title,
          canonicalPath: `/${params.locale}/school`,
          description: loaderData.description,
          image,
          indexable: true,
          jsonLd: [
            ...makeBreadcrumbNodes(
              createBreadcrumbItems(params.locale, [
                { name: loaderData.breadcrumb.home, path: "" },
                { name: loaderData.breadcrumb.school, path: "/school" },
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
                url: `${url}/pricing`,
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
  component: SchoolLanding,
});

/** The pricing teaser: the three plans at their monthly price, and the way to compare them. */
function SchoolTeaser() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="pricing" labelledBy="school-teaser-title">
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <div className="mx-auto grid max-w-2xl gap-3 text-center">
          <h2
            className="text-3xl tracking-tight text-balance sm:text-4xl"
            id="school-teaser-title"
          >
            {t("teaser-title")}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            {t("teaser-lead")}
          </p>
        </div>
        <SchoolPeriodProvider>
          <SchoolPlans />
        </SchoolPeriodProvider>
        <div className="grid justify-items-center gap-3 text-center">
          <Link
            className={buttonVariants({ variant: "outline" })}
            to="/$locale/school/pricing"
          >
            {t("teaser-link")}
          </Link>
          <p className="text-muted-foreground text-sm text-pretty">
            {t("tax-note")}
          </p>
        </div>
      </div>
    </MarketingSection>
  );
}

/** The School landing: what a school gets, how it starts, why to trust it, its price and its questions. */
function SchoolLanding() {
  const { faqs } = Route.useLoaderData();

  return (
    <>
      <PageField />
      <div className="relative grid grid-cols-1">
        <SchoolHero />
        <SchoolFeatures />
        <SchoolSteps />
        <SchoolProof />
        <SchoolTeaser />
        <SchoolFaq>
          <FaqAccordion faqs={faqs} openFirst />
        </SchoolFaq>
        <SchoolClosing />
      </div>
    </>
  );
}
