import { buttonVariants } from "@repo/design-system/lib/button";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeBreadcrumbNodes,
  makeFaqPageNode,
  makePlanNode,
} from "@repo/seo/jsonld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import {
  IntlProvider,
  useLocale,
  useMessages,
  useTimeZone,
  useTranslations,
} from "use-intl";
import { createTranslator } from "use-intl/core";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion";
import { DeferredSchoolToys } from "@/components/marketing/school/deferred";
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
  // A warm of a link to this page is a preload: it takes the page's code and data, never the sections a reader
  // reaches by scrolling, which a navigation opens here before the page commits.
  beforeLoad: async ({ preload }) => {
    if (!preload) {
      await openSchoolLanding();
    }
  },
  loader: async ({ params }) => {
    const [messages, inApp] = await Promise.all([
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: ["Common", "SchoolSite"],
      }),
      // The words of the School screens the sections draw as the app does: the forum, the editor's
      // toolbar and the exam editor. Only this page reads them; the player's are the marketing pages'.
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: ["Classroom", "Editor", "Exams"],
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
      inApp,
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
              makePlanNode({
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
 * each with the real School screen beside or under its words, its questions,
 * and the closing question. Every section after the hero loads its code as it
 * nears, and the toys come on a wide screen once the page has its reader.
 */
function SchoolLanding() {
  const { faqs } = Route.useLoaderData();
  const t = useTranslations("SchoolSite");

  return (
    <InAppMessages>
      <PageField />
      <div className="relative grid grid-cols-1">
        <SchoolHero />
        <DeferredSchoolToys page="landing" />
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
        <LaterSection code={schoolSections.player}>
          {(SchoolPlayer) => <SchoolPlayer />}
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
    </InAppMessages>
  );
}

/**
 * The page's messages with the words of the School screens its sections draw, so a forum, an editor
 * or a player on the page reads its own dictionary as it does in the app. Its value is the loader's,
 * so it never changes after hydration.
 */
function InAppMessages({ children }: { children: ReactNode }) {
  const { inApp } = Route.useLoaderData();
  const locale = useLocale();
  const messages = useMessages();
  const timeZone = useTimeZone();

  return (
    <IntlProvider
      locale={locale}
      messages={{ ...messages, ...inApp }}
      {...(timeZone === undefined ? {} : { timeZone })}
    >
      {children}
    </IntlProvider>
  );
}
