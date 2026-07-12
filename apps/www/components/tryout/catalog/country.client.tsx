"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ChoiceCardContent } from "@/components/shared/choice/card";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import {
  ChoiceCardIcon,
  ChoiceCardVisual,
} from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutExamIcon } from "@/components/tryout/catalog/icons";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type CountryPageQuery = typeof api.tryouts.queries.catalog.getCountryPage;

/** Renders one realtime try-out country page from Convex. */
export function TryoutCountryPageClient({
  page,
}: {
  page: NonNullable<FunctionReturnType<CountryPageQuery>>;
}) {
  if (page.exams.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 pb-24 md:grid-cols-3">
      {page.exams.map((exam) => {
        const icon = getTryoutExamIcon(exam.examKey);

        return (
          <TryoutIntentLink
            className={choiceCardVariants()}
            href={getTryoutPublicPathHref(exam.publicPath)}
            key={exam.examKey}
          >
            <ChoiceCardVisual seed={exam.publicPath}>
              <ChoiceCardIcon icon={icon} />
            </ChoiceCardVisual>
            <ChoiceCardContent>
              <h2>{exam.title}</h2>
            </ChoiceCardContent>
          </TryoutIntentLink>
        );
      })}
    </div>
  );
}
