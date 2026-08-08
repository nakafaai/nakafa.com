"use client";

import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { Locale } from "next-intl";
import { TryoutList } from "@/components/tryout/catalog/list";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import {
  getTryoutAttemptHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import type { CurrentAttempt, SetPage } from "@/components/tryout/set/model";

type SetSection = SetPage["sections"][number];
type SectionStatus = CurrentAttempt["status"];

export interface TryoutSectionRowsValue {
  attempt?: CurrentAttempt | null;
  emptyLabel: string;
  locale: Locale;
  questionUnitLabel: string;
  sections: readonly SetSection[];
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
  const boundAttempt = value.attempt ?? null;
  const activeSectionKey = activeAttempt?.activeSectionKey ?? null;
  const completedSections = new Set(value.attempt?.completedSectionKeys ?? []);
  const currentSectionKey = activeAttempt?.resumeSectionKey ?? null;
  const sections: readonly SectionRow[] =
    boundAttempt?.sectionRoutes ?? value.sections;

  return (
    <TryoutList
      emptyLabel={value.emptyLabel}
      rows={sections.flatMap((section) => {
        const publicPath = section.publicPath;
        if (!publicPath) {
          return [];
        }

        return [
          {
            current: section.sectionKey === currentSectionKey,
            description: `${section.questionCount} ${value.questionUnitLabel}`,
            href: boundAttempt
              ? getTryoutAttemptHref(publicPath, boundAttempt.attemptId)
              : getTryoutPublicPathHref(publicPath),
            key: section.sectionKey,
            onIntent: () =>
              prewarmData({
                ...(boundAttempt ? { attemptId: boundAttempt.attemptId } : {}),
                kind: "section",
                locale: value.locale,
                publicPath,
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

type SectionRow = Pick<
  SetSection | CurrentAttempt["sectionRoutes"][number],
  "publicPath" | "questionCount" | "sectionKey" | "title"
>;

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
