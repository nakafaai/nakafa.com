"use client";

import { getTileLooks } from "@repo/design-system/lib/look";
import { Array as Arr, HashSet, Tuple } from "effect";
import { useTranslations } from "use-intl";
import { getTryoutSubjectIcons } from "@/components/tryout/catalog/icons";
import { TryoutList } from "@/components/tryout/catalog/list";
import {
  getTryoutAttemptHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import type { CurrentAttempt, SetPage } from "@/components/tryout/set/model";

type SetSection = Pick<
  SetPage["sections"][number],
  "publicPath" | "sectionKey" | "timeLimitSeconds" | "title"
>;
type SectionStatus = CurrentAttempt["status"];

/**
 * Renders the divided list of a set's visible sections with their time, or
 * nothing for a set without them. Rows open the sections of the
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
  const shown = Arr.flatMap(sections, (section) =>
    section.publicPath ? [{ publicPath: section.publicPath, section }] : []
  );
  const looks = getTileLooks(
    Arr.map(shown, ({ section }) =>
      Tuple.make(getTryoutSubjectIcons(section.sectionKey), section.sectionKey)
    )
  );
  return (
    <TryoutList
      emptyLabel={tTryouts("list-empty")}
      rows={Arr.zipWith(shown, looks, ({ publicPath, section }, look) => {
        const status = getSectionStatus({
          activeSectionKey: runningAttempt?.activeSectionKey ?? null,
          completedSections,
          sectionKey: section.sectionKey,
        });
        return {
          current: section.sectionKey === currentSectionKey,
          description: tTryouts("set-duration-minutes", {
            minutes: section.timeLimitSeconds / 60,
          }),
          href: attempt
            ? getTryoutAttemptHref(publicPath, attempt.attemptId)
            : getTryoutPublicPathHref(publicPath),
          key: section.sectionKey,
          ...(status === undefined ? {} : { status }),
          title: section.title,
          visual: look,
        };
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
