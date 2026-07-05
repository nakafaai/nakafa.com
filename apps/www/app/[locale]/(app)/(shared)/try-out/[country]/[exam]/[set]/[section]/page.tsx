import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutSectionPage } from "@/components/tryout/section-page";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { fetchTryoutSection } from "@/lib/tryout/catalog";

/** Renders the public question payload for one try-out section. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    section: string;
    set: string;
  }>;
}) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
  } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const sectionPath = getTryoutHref({ country, exam, section, set }).slice(1);
  const [sectionPage, tTryouts] = await Promise.all([
    fetchTryoutSection({ locale, publicPath: sectionPath }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);

  if (!sectionPage) {
    notFound();
  }

  return (
    <TryoutSectionPage
      backHref={getTryoutHref({
        country,
        exam,
        set,
      })}
      backLabel={tTryouts("back-to-set")}
      description={sectionPage.section.description}
      questionCountLabel={tTryouts("question-count", {
        count: sectionPage.section.questionCount,
      })}
      questions={sectionPage.questions}
      title={sectionPage.section.title}
    />
  );
}
