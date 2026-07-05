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
import { fetchTryoutCountries, fetchTryoutExams } from "@/lib/tryout/catalog";

/** Renders active exam families for one try-out country. */
export default async function Page(props: {
  params: Promise<{ country: string; locale: string }>;
}) {
  const { country, locale: localeParam } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const [countries, exams, tTryouts] = await Promise.all([
    fetchTryoutCountries({ locale }),
    fetchTryoutExams({ locale, publicPath: countryPath }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const countryRow = countries.find((item) => item.publicPath === countryPath);

  if (!countryRow) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
      <div className="space-y-8">
        <TryoutPageHeader
          description={countryRow.description}
          link={{ href: getTryoutHref(), label: tTryouts("back-to-tryout") }}
          title={countryRow.title}
        />

        <TryoutCatalogGrid
          emptyLabel={tTryouts("list-empty")}
          items={exams.map((exam) => ({
            badge: getTryoutScoringLabel(tTryouts, exam.scoringStrategy),
            ctaLabel: tTryouts("open-exam-cta"),
            description: exam.description,
            href: getTryoutPublicPathHref(exam.publicPath),
            title: exam.title,
          }))}
        />
      </div>
    </div>
  );
}
