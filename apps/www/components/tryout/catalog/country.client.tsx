"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { FunctionReturnType } from "convex/server";
import { ChoiceCardContent } from "@/components/shared/choice/card";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import {
  ChoiceCardIcon,
  ChoiceCardVisual,
} from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutExamIcon } from "@/components/tryout/catalog/icons";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type CountryPageQuery = typeof api.tryouts.queries.catalog.getCountryPage;

/** Renders one compact exam chooser with identity-owned gradient icons. */
export function TryoutCountryPageClient({
  page,
}: {
  page: {
    readonly exams: NonNullable<FunctionReturnType<CountryPageQuery>>["exams"];
  };
}) {
  if (page.exams.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 pb-24 md:grid-cols-3">
      {page.exams.map((exam) => (
        <IntentLink
          className={choiceCardVariants()}
          href={getTryoutPublicPathHref(exam.publicPath)}
          key={exam.examKey}
        >
          <ChoiceCardVisual seed={exam.publicPath}>
            <ChoiceCardIcon icon={getTryoutExamIcon(exam.examKey)} />
          </ChoiceCardVisual>
          <ChoiceCardContent>
            <h2>{exam.title}</h2>
          </ChoiceCardContent>
        </IntentLink>
      ))}
    </div>
  );
}
