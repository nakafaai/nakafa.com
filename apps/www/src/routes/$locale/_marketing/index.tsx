import { NINA_RESPONSE_CREDITS } from "@repo/backend/confect/credits/constants";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  makeCollectionPageNode,
  makeFaqPageNode,
} from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { createTranslator } from "use-intl/core";
import { Hero } from "@/components/marketing/about/hero";
import {
  homeSections,
  openHomeSections,
} from "@/components/marketing/about/later";
import { CLASS_HERD } from "@/components/marketing/about/toys/herd";
import { HomeToys } from "@/components/marketing/about/toys/intent";
import { PageField } from "@/components/marketing/shared/field";
import { LaterSection } from "@/components/marketing/shared/later";
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
import { readStaticData } from "@/lib/static/data";

/**
 * The marketing home. Its first HTML holds the whole page: the featured try-out,
 * the subject collection and the questions are read before the stream, and the
 * head names the locale's title, description, structured data and price currency
 * script. The structured data is plain data that the head seam emits.
 */
export const Route = createFileRoute("/$locale/_marketing/")({
  loader: async ({ params }) => {
    const [, curricula, featuredTryout, messages] = await Promise.all([
      openHomeSections(),
      readStaticData(readHomeCurriculaFn, { locale: params.locale }),
      readStaticData(readHomeTryout, { locale: params.locale }),
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: ["Landing", "Metadata", "Subject"],
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
  const { featuredTryout } = Route.useLoaderData();

  return (
    <>
      <PageField />
      <div className="relative grid grid-cols-1">
        <Hero />
        <LaterSection code={homeSections.lesson}>
          {(Lesson) => <Lesson locale={locale} />}
        </LaterSection>
        <LaterSection code={homeSections.tryout}>
          {(Tryout) => <Tryout value={featuredTryout} />}
        </LaterSection>
        <LaterSection code={homeSections.nina}>
          {(NinaSection) => <NinaSection />}
        </LaterSection>
        <LaterSection code={homeSections.memory}>
          {(Memory) => <Memory />}
        </LaterSection>
        <LaterSection code={homeSections.privacy}>
          {(Privacy) => <Privacy />}
        </LaterSection>
        <LaterSection code={homeSections.curricula}>
          {(Curricula) => <Curricula />}
        </LaterSection>
        <LaterSection code={homeSections.letter}>
          {(Letter) => <Letter />}
        </LaterSection>
        <LaterSection code={homeSections.medals}>
          {(Medals) => <Medals />}
        </LaterSection>
        <LaterSection code={homeSections.pricing}>
          {(Pricing) => <Pricing />}
        </LaterSection>
        <LaterSection code={homeSections.schools}>
          {(Schools) => <Schools herd={CLASS_HERD} />}
        </LaterSection>
        <LaterSection code={homeSections.faq}>{(Faq) => <Faq />}</LaterSection>
        <LaterSection code={homeSections.community}>
          {(Community) => <Community />}
        </LaterSection>
        <LaterSection code={homeSections.closing}>
          {(Closing) => <Closing />}
        </LaterSection>
        <HomeToys />
      </div>
    </>
  );
}
