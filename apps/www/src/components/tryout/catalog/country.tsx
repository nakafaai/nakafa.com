import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "use-intl";

import {
  CatalogCard,
  CatalogCardPlate,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import { ComingSoon } from "@/components/shared/upcoming";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { CardArtworkSchema } from "@/lib/tryout/artwork";

type CountryPageQuery = typeof tryouts.queries.catalog.getCountryPage;
type CountryPage = NonNullable<Ref.Returns<CountryPageQuery>>;
/** An exam card's image: only an entity's card artwork, never a page's social image. */
const CountryExamCardImageSchema = Schema.Struct({
  imageSrc: Schema.optionalKey(CardArtworkSchema),
});

type CountryExamCard = CountryPage["exams"][number] &
  typeof CountryExamCardImageSchema.Type;

/** Renders one signed try-out country's exams, each a card with its own artwork or its name on a plate. */
export function TryoutCountryPageClient({
  page,
}: {
  page: {
    readonly exams: readonly CountryExamCard[];
  };
}) {
  const tTryouts = useTranslations("Tryouts");
  if (page.exams.length === 0) {
    return <ComingSoon />;
  }

  return (
    <CatalogActionLabelContext value={tTryouts("open-exam-cta")}>
      <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
        {Arr.map(page.exams, (exam, index) => (
          <CatalogCard
            action={(anchor) => (
              <TryoutPageLink {...anchor} publicPath={exam.entryPath} />
            )}
            key={exam.examKey}
            title={exam.title}
          >
            {exam.imageSrc === undefined ? (
              <CatalogCardPlate title={exam.title} />
            ) : (
              <CatalogCardVisual preload={index === 0} visual={exam.imageSrc} />
            )}
          </CatalogCard>
        ))}
      </div>
    </CatalogActionLabelContext>
  );
}
