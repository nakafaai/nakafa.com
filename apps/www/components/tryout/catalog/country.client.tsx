"use client";

import type { Ref } from "@confect/core";

import type refs from "@repo/backend/confect/_generated/refs";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";

import {
  CatalogCard,
  CatalogCardGradient,
  CatalogCardImage,
} from "@/components/shared/catalog/card";
import { ChoiceCardIcon } from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/upcoming";
import { getTryoutExamIcon } from "@/components/tryout/catalog/icons";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type CountryPageQuery =
  typeof refs.public.tryouts.queries.catalog.getCountryPage;
type CountryPage = NonNullable<Ref.Returns<CountryPageQuery>>;
type CountryExamCard = CountryPage["exams"][number] & {
  readonly imageSrc?: string;
};

/** Renders one signed try-out country catalog with reviewed or gradient art. */
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

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {page.exams.map((exam, index) => (
        <CatalogCard
          action={
            <IntentLink href={getTryoutPublicPathHref(exam.publicPath)} />
          }
          actionLabel={actionLabel}
          key={exam.examKey}
          title={exam.title}
        >
          {exam.imageSrc ? (
            <CatalogCardImage preload={index === 0} src={exam.imageSrc} />
          ) : (
            <CatalogCardGradient seed={exam.publicPath}>
              <ChoiceCardIcon icon={getTryoutExamIcon(exam.examKey)} />
            </CatalogCardGradient>
          )}
        </CatalogCard>
      ))}
    </div>
  );
}
