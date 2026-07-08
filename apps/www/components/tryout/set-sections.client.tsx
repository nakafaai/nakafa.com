"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { FunctionReturnType } from "convex/server";
import { TryoutList } from "@/components/tryout/list";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;
type SetPage = NonNullable<FunctionReturnType<SetPageQuery>>;
type SetSection = SetPage["sections"][number];

/** Renders the production-style divided visible section list for one set page. */
export function TryoutSectionRows({
  attempt,
  emptyLabel,
  questionUnitLabel,
  sections,
}: {
  attempt?: FunctionReturnType<typeof api.tryouts.queries.attempt.getCurrent>;
  emptyLabel: string;
  questionUnitLabel: string;
  sections: readonly SetSection[];
}) {
  const activeAttempt = attempt?.status === "in-progress" ? attempt : null;
  const completedSections = new Set(activeAttempt?.completedSectionKeys ?? []);
  const currentSectionKey = activeAttempt?.resumeSectionKey ?? null;

  return (
    <TryoutList
      emptyLabel={emptyLabel}
      rows={sections.flatMap((section) => {
        if (!section.publicPath) {
          return [];
        }

        return [
          {
            current: section.sectionKey === currentSectionKey,
            description: `${section.questionCount} ${questionUnitLabel}`,
            href: getTryoutPublicPathHref(section.publicPath),
            key: section.sectionKey,
            status: completedSections.has(section.sectionKey)
              ? "completed"
              : undefined,
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
