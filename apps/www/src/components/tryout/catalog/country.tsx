import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { getTileLooks } from "@repo/design-system/lib/look";

import { Array as Arr, Schema, Tuple } from "effect";

import {
  CatalogCard,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { ComingSoon } from "@/components/shared/upcoming";
import { getTryoutExamIcons } from "@/components/tryout/catalog/icons";
import { TryoutPageLink } from "@/components/tryout/route/link";

type CountryPageQuery = typeof tryouts.queries.catalog.getCountryPage;
type CountryPage = NonNullable<Ref.Returns<CountryPageQuery>>;
const CountryExamCardImageSchema = Schema.Struct({
  imageSrc: Schema.optionalKey(Schema.String),
});

type CountryExamCard = CountryPage["exams"][number] &
  typeof CountryExamCardImageSchema.Type;

/** Renders one signed try-out country catalog with reviewed art or tiles. */
export function TryoutCountryPageClient({
  actionLabel,
  page,
}: {
  actionLabel: string;
  page: {
    readonly exams: readonly CountryExamCard[];
  };
}) {
  if (page.exams.length === 0) {
    return <ComingSoon />;
  }

  const visuals = getTileLooks(
    Arr.map(
      page.exams,
      (exam) =>
        exam.imageSrc ??
        Tuple.make(getTryoutExamIcons(exam.examKey), exam.examKey)
    )
  );

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(page.exams, visuals), ([exam, visual], index) => (
        <CatalogCard
          action={<TryoutPageLink publicPath={exam.publicPath} />}
          actionLabel={actionLabel}
          key={exam.examKey}
          title={exam.title}
        >
          <CatalogCardVisual preload={index === 0} visual={visual} />
        </CatalogCard>
      ))}
    </div>
  );
}
