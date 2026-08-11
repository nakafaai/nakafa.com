"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { FunctionReturnType } from "convex/server";
import {
  CatalogCard,
  CatalogCardImage,
} from "@/components/shared/catalog/card";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type CountryPageQuery = typeof api.tryouts.queries.catalog.getCountryPage;
type CountryPage = NonNullable<FunctionReturnType<CountryPageQuery>>;
type CountryExamCard = CountryPage["exams"][number] & {
  readonly imageSrc: string;
};

interface TryoutCountryPage {
  readonly exams: readonly CountryExamCard[];
}

/** Renders one signed try-out country catalog with explicit exam actions. */
export function TryoutCountryPageClient({
  actionLabel,
  page,
}: {
  actionLabel: string;
  page: TryoutCountryPage;
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
          <CatalogCardImage preload={index === 0} src={exam.imageSrc} />
        </CatalogCard>
      ))}
    </div>
  );
}
