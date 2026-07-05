import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TryoutCatalogGrid } from "@/components/tryout/catalog-grid";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { TryoutPageHeader } from "@/components/tryout/shared/page-header";
import { StartTryoutButton } from "@/components/tryout/start-button";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { fetchTryoutSet } from "@/lib/tryout/catalog";

/** Renders one try-out set and its section list. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
  }>;
}) {
  const { country, exam, locale: localeParam, set } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const setPath = getTryoutHref({ country, exam, set }).slice(1);
  const [setPage, tTryouts] = await Promise.all([
    fetchTryoutSet({ locale, publicPath: setPath }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);

  if (!setPage) {
    notFound();
  }

  const firstSection = setPage.sections[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
      <div className="space-y-8">
        <TryoutPageHeader
          description={setPage.set.description ?? tTryouts("slug-description")}
          link={{
            href: getTryoutHref({ country, exam }),
            label: tTryouts("back-to-exam"),
          }}
          status={tTryouts("available-item-description", {
            questions: setPage.set.totalQuestionCount,
            sections: setPage.set.sectionCount,
          })}
          title={setPage.set.title}
        />

        {firstSection ? (
          <StartTryoutButton
            countryKey={setPage.set.countryKey}
            examKey={setPage.set.examKey}
            firstSectionHref={getTryoutPublicPathHref(firstSection.publicPath)}
            label={tTryouts("start-cta")}
            locale={locale}
            setKey={setPage.set.setKey}
          />
        ) : null}

        <TryoutCatalogGrid
          emptyLabel={tTryouts("list-empty")}
          items={setPage.sections.map((section) => ({
            badge: tTryouts("question-count", {
              count: section.questionCount,
            }),
            ctaLabel: tTryouts("open-section-cta"),
            description: section.description,
            href: getTryoutPublicPathHref(section.publicPath),
            title: section.title,
          }))}
        />
      </div>
    </div>
  );
}
