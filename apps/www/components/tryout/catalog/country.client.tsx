"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { FunctionReturnType } from "convex/server";
import {
  CatalogCard,
  CatalogCardGradient,
} from "@/components/shared/catalog/card";
import { ChoiceCardIcon } from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutExamIcon } from "@/components/tryout/catalog/icons";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type CountryPageQuery = typeof api.tryouts.queries.catalog.getCountryPage;

/** Renders one signed try-out country catalog with gradient exam artwork. */
export function TryoutCountryPageClient({
  actionLabel,
  page,
}: {
  actionLabel: string;
  page: {
    readonly exams: NonNullable<FunctionReturnType<CountryPageQuery>>["exams"];
  };
}) {
  if (page.exams.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {page.exams.map((exam) => (
        <CatalogCard
          action={
            <IntentLink href={getTryoutPublicPathHref(exam.publicPath)} />
          }
          actionLabel={actionLabel}
          key={exam.examKey}
          title={exam.title}
        >
          <CatalogCardGradient seed={exam.publicPath}>
            <ChoiceCardIcon icon={getTryoutExamIcon(exam.examKey)} />
          </CatalogCardGradient>
        </CatalogCard>
      ))}
    </div>
  );
}
