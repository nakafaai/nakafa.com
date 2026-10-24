import { NINA_RESPONSE_CREDITS } from "@repo/backend/confect/credits/constants";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeCollectionPageNode,
  makeFaqPageNode,
} from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { createTranslator } from "use-intl";
import { Closing } from "@/components/marketing/about/closing";
import { Community } from "@/components/marketing/about/community";
import { Curricula } from "@/components/marketing/about/curricula";
import { Faq } from "@/components/marketing/about/faq/landing";
import { Hero } from "@/components/marketing/about/hero";
import { Lesson } from "@/components/marketing/about/lesson";
import { Letter } from "@/components/marketing/about/letter";
import { Medals } from "@/components/marketing/about/medals";
import { Memory } from "@/components/marketing/about/memory";
import { NinaSection } from "@/components/marketing/about/nina/section";
import { Pricing } from "@/components/marketing/about/pricing/landing";
import { Privacy } from "@/components/marketing/about/privacy";
import { Schools } from "@/components/marketing/about/schools";
import { CLASS_HERD } from "@/components/marketing/about/toys/herd";
import { HomeToys } from "@/components/marketing/about/toys/intent";
import { Tryout } from "@/components/marketing/about/tryout";
import { PageField } from "@/components/marketing/shared/field";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import type { MarketingFaqItem } from "@/lib/marketing/faq";
import {
  readHomeCurriculaFn,
  readHomeTryout,
} from "@/lib/marketing/home.functions";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/**
 * The marketing home. Its first HTML holds the whole page: the featured try-out,
 * the subject collection and the questions are read before the stream, and the
 * head names the locale's title, description, structured data and price currency
 * script. The structured data is plain data that the head seam emits.
 */
export const Route = createFileRoute("/$locale/_marketing/")({
  loader: async ({ params }) => {
    const [curricula, featuredTryout, messages] = await Promise.all([
      readHomeCurriculaFn({ data: { locale: params.locale } }),
      readHomeTryout({ data: { locale: params.locale } }),
      readRouteMessages({
        data: {
          locale: params.locale,
          namespaces: ["Landing", "Metadata", "Subject"],
        },
      }),
    ]);
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Metadata",
    });
    const tHome = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Landing",
    });
    const tSubject = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Subject",
    });
    const collection = Arr.flatMap(subjectMenu, (category) =>
      Arr.map(category.items, (item) => {
        const name =
          item.title === "grade"
            ? `${tSubject(category.title)} ${tSubject("grade", { grade: item.value })}`
            : `${tSubject(category.title)} ${tSubject(item.title)}`;
        return {
          description: tSubject("grade-description"),
          name,
          url: `${COMPANY_IDENTITY.url}/${params.locale}${getSubjectMenuHref(item, params.locale)}`,
        };
      })
    );

    /**
     * The ten questions of the home page, in the order the page asks them, the
     * first one open. They are the questions no other part of the page answers.
     */
    const faqs: MarketingFaqItem[] = Arr.map(
      [
        "subjects",
        "account",
        "phone",
        "languages",
        "nina",
        "credits",
        "empty",
        "memory",
        "data",
        "accuracy",
      ] as const,
      (key) => ({
        answer: tHome(`faq-${key}-answer`, { cost: NINA_RESPONSE_CREDITS }),
        question: tHome(`faq-${key}-question`),
      })
    );

    return {
      collection,
      curricula,
      description: t("description"),
      faqs,
      featuredTryout,
      title: t("title"),
    };
  },
  head: ({ loaderData, params }) => {
    if (loaderData === undefined) {
      return {};
    }
    const url = `${COMPANY_IDENTITY.url}/${params.locale}`;
    return {
      ...toRouterHead(
        createSeoHead({
          absoluteTitle: loaderData.title,
          canonicalPath: `/${params.locale}`,
          description: loaderData.description,
          image: getAppSocialArtwork({
            key: "home",
            locale: params.locale,
            publicPath: "",
          }),
          indexable: true,
          jsonLd: [
            makeCollectionPageNode({
              description: loaderData.description,
              items: loaderData.collection,
              name: loaderData.title,
              url,
            }),
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
  component: HomePage,
});

/** The marketing home: the sections of the landing page. */
function HomePage() {
  const { locale } = Route.useParams();
  const { curricula, faqs, featuredTryout } = Route.useLoaderData();

  return (
    <>
      <PageField />
      <div className="relative grid grid-cols-1">
        <Hero />
        <Lesson locale={locale} />
        <Tryout value={featuredTryout} />
        <NinaSection />
        <Memory />
        <Privacy />
        <Curricula curricula={curricula} />
        <Letter />
        <Medals />
        <Pricing />
        <Schools herd={CLASS_HERD} />
        <Faq faqs={faqs} />
        <Community />
        <Closing />
        <HomeToys />
      </div>
    </>
  );
}
