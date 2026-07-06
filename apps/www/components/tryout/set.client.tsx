"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutList } from "@/components/tryout/list";
import { TryoutMeta } from "@/components/tryout/meta";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { StartTryoutButton } from "@/components/tryout/start-button";

interface TryoutSetPageClientProps {
  country: string;
  exam: string;
  locale: Locale;
  publicPath: string;
}

type SetPage = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.catalog.getSetPage>
>;
type SetSection = SetPage["sections"][number];

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  country,
  exam,
  locale,
  publicPath,
}: TryoutSetPageClientProps) {
  const page = useQuery(api.tryouts.queries.catalog.getSetPage, {
    locale,
    publicPath,
  });
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    page
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          setKey: page.set.setKey,
        }
      : "skip"
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");

  if (!page) {
    return null;
  }

  const firstSection = page.sections[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHeader
            description={page.set.description ?? tTryouts("slug-description")}
            link={{
              href: getTryoutHref({ country, exam }),
              label: tCommon("back"),
            }}
            meta={<TryoutMeta items={[page.exam.title, page.set.title]} />}
            title={page.set.title}
          />

          {firstSection ? (
            <div>
              <StartTryoutButton
                attempt={attempt}
                countryKey={page.set.countryKey}
                examKey={page.set.examKey}
                firstSectionHref={getTryoutPublicPathHref(
                  firstSection.publicPath
                )}
                locale={locale}
                setKey={page.set.setKey}
              />
            </div>
          ) : null}
        </div>

        <TryoutSectionRows
          emptyLabel={tTryouts("list-empty")}
          questionUnitLabel={tTryouts("question-unit")}
          sections={page.sections}
        />
      </div>
    </div>
  );
}

/** Renders the production-style divided section list for one set page. */
function TryoutSectionRows({
  emptyLabel,
  questionUnitLabel,
  sections,
}: {
  emptyLabel: string;
  questionUnitLabel: string;
  sections: readonly SetSection[];
}) {
  return (
    <TryoutList
      emptyLabel={emptyLabel}
      rows={sections.map((section) => ({
        description: `${section.questionCount} ${questionUnitLabel}`,
        href: getTryoutPublicPathHref(section.publicPath),
        icon: getMaterialIcon(section.sectionKey),
        iconKey: section.sectionKey,
        key: section.sectionKey,
        title: section.title,
      }))}
    />
  );
}
