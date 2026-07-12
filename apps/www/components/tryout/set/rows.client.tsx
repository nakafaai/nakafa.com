"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { TryoutList } from "@/components/tryout/catalog/list";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;
type SetPage = NonNullable<FunctionReturnType<SetPageQuery>>;
type SetSection = SetPage["sections"][number];
type SectionStatus = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempt.getCurrent>
>["status"];

export interface TryoutSectionRowsValue {
  attempt?: FunctionReturnType<typeof api.tryouts.queries.attempt.getCurrent>;
  emptyLabel: string;
  locale: Locale;
  questionUnitLabel: string;
  sections: readonly SetSection[];
  set: Pick<SetPage["set"], "countryKey" | "examKey" | "setKey" | "trackKey">;
}

/** Renders the production-style divided visible section list for one set page. */
export function TryoutSectionRows({
  value,
}: {
  value: TryoutSectionRowsValue;
}) {
  const prewarmData = useTryoutDataIntent();
  const activeAttempt =
    value.attempt?.status === "in-progress" ? value.attempt : null;
  const activeSectionKey = activeAttempt?.activeSectionKey ?? null;
  const completedSections = new Set(activeAttempt?.completedSectionKeys ?? []);
  const currentSectionKey = activeAttempt?.resumeSectionKey ?? null;

  return (
    <TryoutList
      emptyLabel={value.emptyLabel}
      rows={value.sections.flatMap((section) => {
        if (!section.publicPath) {
          return [];
        }

        return [
          {
            current: section.sectionKey === currentSectionKey,
            description: `${section.questionCount} ${value.questionUnitLabel}`,
            href: getTryoutPublicPathHref(section.publicPath),
            key: section.sectionKey,
            onIntent: () =>
              prewarmData({
                countryKey: value.set.countryKey,
                examKey: value.set.examKey,
                kind: "section",
                locale: value.locale,
                sectionKey: section.sectionKey,
                setKey: value.set.setKey,
                trackKey: value.set.trackKey,
              }),
            status: getSectionStatus({
              activeSectionKey,
              completedSections,
              sectionKey: section.sectionKey,
            }),
            title: section.title,
            visual: {
              icon: getMaterialIcon(section.sectionKey),
              iconKey: section.sectionKey,
              kind: "icon",
            },
          },
        ];
      })}
    />
  );
}

/** Resolves one nested section's canonical workflow status. */
function getSectionStatus({
  activeSectionKey,
  completedSections,
  sectionKey,
}: {
  activeSectionKey: string | null;
  completedSections: ReadonlySet<string>;
  sectionKey: string;
}): SectionStatus | undefined {
  if (sectionKey === activeSectionKey) {
    return "in-progress";
  }

  if (completedSections.has(sectionKey)) {
    return "completed";
  }

  return;
}
