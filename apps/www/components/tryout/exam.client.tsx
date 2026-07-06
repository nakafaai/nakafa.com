"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTryoutSetIcon } from "@/components/tryout/icons";
import { TryoutList } from "@/components/tryout/list";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

interface TryoutExamPageClientProps {
  locale: Locale;
  publicPath: string;
}

/** Renders one realtime try-out exam page from Convex. */
export function TryoutExamPageClient({
  locale,
  publicPath,
}: TryoutExamPageClientProps) {
  const page = useQuery(api.tryouts.queries.catalog.getExamPage, {
    locale,
    publicPath,
  });
  const tTryouts = useTranslations("Tryouts");

  if (!page) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
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
