import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TryoutCatalogGrid } from "@/components/tryout/catalog-grid";
import { getTryoutScoringLabel } from "@/components/tryout/labels";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { TryoutPageHeader } from "@/components/tryout/shared/page-header";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import {
  fetchTryoutCountries,
  fetchTryoutExams,
  fetchTryoutSets,
} from "@/lib/tryout/catalog";

/** Renders active try-out sets for one country and exam family. */
export default async function Page(props: {
  params: Promise<{ country: string; exam: string; locale: string }>;
}) {
  const { country, exam, locale: localeParam } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const examPath = getTryoutHref({ country, exam }).slice(1);
  const [countries, exams, sets, tTryouts] = await Promise.all([
    fetchTryoutCountries({ locale }),
    fetchTryoutExams({ locale, publicPath: countryPath }),
    fetchTryoutSets({ locale, publicPath: examPath }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const countryRow = countries.find((item) => item.publicPath === countryPath);
  const examRow = exams.find((item) => item.publicPath === examPath);

  if (!(countryRow && examRow)) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
      <div className="space-y-8">
        <TryoutPageHeader
          description={examRow.description}
          link={{
            href: getTryoutPublicPathHref(countryRow.publicPath),
            label: tTryouts("back-to-country"),
          }}
          status={getTryoutScoringLabel(tTryouts, examRow.scoringStrategy)}
          title={examRow.title}
        />

        <TryoutCatalogGrid
          emptyLabel={tTryouts("list-empty")}
          items={sets.map((set) => ({
            badge: tTryouts("section-count", { count: set.sectionCount }),
            ctaLabel: tTryouts("open-set-cta"),
            description: set.description,
            href: getTryoutPublicPathHref(set.publicPath),
            meta: tTryouts("available-item-description", {
              questions: set.totalQuestionCount,
              sections: set.sectionCount,
            }),
            title: set.title,
          }))}
        />
      </div>
    </div>
  );
}
