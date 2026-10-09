"use client";

import { Array as Arr, HashSet } from "effect";
import { useTranslations } from "next-intl";
import { getTryoutSubjectIcon } from "@/components/tryout/catalog/icons";
import { TryoutList } from "@/components/tryout/catalog/list";
import {
  getTryoutAttemptHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import type { CurrentAttempt, SetPage } from "@/components/tryout/set/model";

type SetSection = Pick<
  SetPage["sections"][number],
  "publicPath" | "questionCount" | "sectionKey" | "timeLimitSeconds" | "title"
>;
type SectionStatus = CurrentAttempt["status"];

/**
 * Renders the divided list of a set's visible sections with their size and
 * time, or nothing for a set without them. Rows open the sections of the
 * learner's attempt once it is known, and mark progress only while that attempt
 * runs, so a list painted from the catalog keeps every row in place when the
 * attempt arrives.
 */
export function TryoutSectionRows({
  attempt,
  sections,
}: {
  attempt?: CurrentAttempt | null;
  sections: readonly SetSection[];
}) {
  const tTryouts = useTranslations("Tryouts");
  if (sections.length === 0) {
    return null;
  }

  const runningAttempt = attempt?.status === "in-progress" ? attempt : null;
  const completedSections = HashSet.fromIterable(
    runningAttempt?.completedSectionKeys ?? []
  );
  const currentSectionKey = runningAttempt?.resumeSectionKey ?? null;
  return (
    <TryoutList
      emptyLabel={tTryouts("list-empty")}
      rows={Arr.flatMap(sections, (section) => {
        const publicPath = section.publicPath;
        if (!publicPath) {
          return [];
        }
        const status = getSectionStatus({
          activeSectionKey: runningAttempt?.activeSectionKey ?? null,
          completedSections,
          sectionKey: section.sectionKey,
        });
        return [
          {
            current: section.sectionKey === currentSectionKey,
            description: `${section.questionCount} ${tTryouts("question-unit")} · ${tTryouts(
              "set-duration-minutes",
              { minutes: section.timeLimitSeconds / 60 }
            )}`,
            href: attempt
              ? getTryoutAttemptHref(publicPath, attempt.attemptId)
              : getTryoutPublicPathHref(publicPath),
            key: section.sectionKey,
            ...(status === undefined ? {} : { status }),
            title: section.title,
            visual: {
              icon: getTryoutSubjectIcon(section.sectionKey),
              iconKey: section.sectionKey,
              kind: "icon",
            },
          },
        ];
      })}
    />
  );
}

/** Resolves one nested section's progress inside a running attempt. */
function getSectionStatus({
  activeSectionKey,
  completedSections,
  sectionKey,
}: {
  activeSectionKey: string | null;
  completedSections: HashSet.HashSet<string>;
  sectionKey: string;
}): SectionStatus | undefined {
  if (sectionKey === activeSectionKey) {
    return "in-progress";
  }
  if (HashSet.has(completedSections, sectionKey)) {
    return "completed";
  }
}
