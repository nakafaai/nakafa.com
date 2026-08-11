"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import {
  CatalogCard,
  CatalogCardImage,
} from "@/components/shared/catalog/card";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { getTryoutExamSocialImage } from "@/lib/tryout/social-images";

type CountryPageQuery = typeof api.tryouts.queries.catalog.getCountryPage;

/** Renders one signed try-out country catalog with explicit exam actions. */
export function TryoutCountryPageClient({
  actionLabel,
  locale,
  page,
}: {
  actionLabel: string;
  locale: Locale;
  page: Pick<
    NonNullable<FunctionReturnType<CountryPageQuery>>,
    "country" | "exams"
  >;
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
          <CatalogCardImage
            preload={index === 0}
            src={getTryoutExamSocialImage({
              countryKey: page.country.countryKey,
              examKey: exam.examKey,
              locale,
              publicPath: exam.publicPath,
            })}
          />
        </CatalogCard>
      ))}
    </div>
  );
}
