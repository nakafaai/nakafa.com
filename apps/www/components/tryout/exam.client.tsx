"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { getTryoutSetIcon } from "@/components/tryout/icons";
import { TryoutList } from "@/components/tryout/list";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

type ExamPageQuery = typeof api.tryouts.queries.catalog.getExamPage;

/** Renders one realtime try-out exam page from Convex. */
export function TryoutExamPageClient({
  preloaded,
}: {
  preloaded: Preloaded<ExamPageQuery>;
}) {
  const page = usePreloadedQuery(preloaded);
  const tTryouts = useTranslations("Tryouts");

  if (!page) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24">
      <TryoutList
        emptyLabel={tTryouts("list-empty")}
        rows={page.sets.map((set) => ({
          description:
            set.description ??
            tTryouts("available-item-description", {
              questions: set.totalQuestionCount,
              sections: set.sectionCount,
            }),
          href: getTryoutPublicPathHref(set.publicPath),
          icon: getTryoutSetIcon(set.setKey),
          iconKey: set.setKey,
          key: set.setKey,
          title: set.title,
        }))}
      />
    </div>
  );
}
