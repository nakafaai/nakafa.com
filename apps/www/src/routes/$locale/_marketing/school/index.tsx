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
import { SchoolHero } from "@/components/marketing/school/hero";
import {
  openSchoolLanding,
  schoolSections,
} from "@/components/marketing/school/later";
import { PageField } from "@/components/marketing/shared/field";
import { LaterSection } from "@/components/marketing/shared/later";
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
    const [, messages] = await Promise.all([
      openSchoolLanding(),
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: ["Common", "SchoolSite"],
      }),
    ]);
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
      key: "school",
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

/**
 * The School landing: its hero, one screen for each thing a school runs on it,
 * each with the real School screen beside its words, its questions, and the
 * closing question. Every section after the hero loads its code as it nears.
 */
function SchoolLanding() {
  const { faqs } = Route.useLoaderData();
  const t = useTranslations("SchoolSite");

  return (
    <>
      <PageField />
      <div className="relative grid grid-cols-1">
        <SchoolHero />
        <LaterSection code={schoolSections.forum}>
          {(SchoolForum) => <SchoolForum />}
        </LaterSection>
        <LaterSection code={schoolSections.library}>
          {(SchoolLibrary) => <SchoolLibrary />}
        </LaterSection>
        <LaterSection code={schoolSections.tasks}>
          {(SchoolTasks) => <SchoolTasks />}
        </LaterSection>
        <LaterSection code={schoolSections.exams}>
          {(SchoolExams) => <SchoolExams />}
        </LaterSection>
        <LaterSection code={schoolSections.reports}>
          {(SchoolReports) => <SchoolReports />}
        </LaterSection>
        <LaterSection code={schoolSections.insight}>
          {(SchoolInsight) => <SchoolInsight />}
        </LaterSection>
        <LaterSection code={schoolSections.graduation}>
          {(SchoolGraduation) => <SchoolGraduation />}
        </LaterSection>
        <LaterSection code={schoolSections.parents}>
          {(SchoolParents) => <SchoolParents />}
        </LaterSection>
        <LaterSection code={schoolSections.faq}>
          {(SchoolFaq) => (
            <SchoolFaq>
              <FaqAccordion faqs={faqs} openFirst />
            </SchoolFaq>
          )}
        </LaterSection>
        <LaterSection code={schoolSections.closing}>
          {(SchoolClosing) => (
            <SchoolClosing>
              <Link
                className={buttonVariants({ size: "lg", variant: "outline" })}
                to="/$locale/school/pricing"
              >
                {t("hero-pricing")}
              </Link>
            </SchoolClosing>
          )}
        </LaterSection>
      </div>
    </>
  );
}
