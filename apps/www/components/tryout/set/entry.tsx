"use client";

import { useTranslations } from "next-intl";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutEntrySummary } from "@/components/tryout/section/summary.client";
import type {
  CurrentAttempt,
  TryoutInternalSetView,
} from "@/components/tryout/set/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

/** Renders a no-nested-section set as the directly startable section surface. */
export function TryoutSetEntry({ value }: { value: TryoutInternalSetView }) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const entryHref = getTryoutHref(value.route);
  const parentHref = getTryoutHref({
    country: value.route.country,
    exam: value.route.exam,
    track: value.route.track,
  });
  const sectionAttempt = value.actionAttempt?.section ?? null;
  const sectionFinished = isFinishedSection(sectionAttempt);
  const sectionTimeExpired = isTimeExpiredSection(sectionAttempt);
  const attemptFinished = Boolean(
    value.actionAttempt && value.actionAttempt.status !== "in-progress"
  );
  let status = tTryouts("entry-head-ready");

  if (value.activeRuntime) {
    status = tTryouts("part-head-in-progress");
  } else if (sectionFinished) {
    status = getTryoutFinishedSectionStatus({
      attemptFinished,
      sectionTimeExpired,
      tTryouts,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          value={{
            link: {
              href: parentHref,
              label: tCommon("back"),
            },
            meta: (
              <TryoutMeta
                items={[
                  value.page.exam.title,
                  value.page.track.title,
                  value.page.set.title,
                ]}
              />
            ),
            status,
            title: value.page.set.title,
          }}
        />

        <div className="space-y-12">
          <TryoutEntrySummary
            value={{
              activeAttempt: value.activeAttempt,
              attempt: value.actionAttempt,
              locale: value.route.locale,
              returnHref: parentHref,
              section: value.entrySection,
              sectionFinished,
              sectionHref: entryHref,
              set: value.page.set,
              startAttemptSectionKey: value.entrySection.sectionKey,
            }}
          />

          {value.runtimeContent ? (
            <TryoutRuntime
              value={{
                expired: value.runtimeContent.section.status !== "in-progress",
                questions: value.content.entryQuestions,
                returnHref: entryHref,
                runtime: value.runtimeContent,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Returns true when a section attempt has reached a terminal state. */
function isFinishedSection(section: NonNullable<CurrentAttempt>["section"]) {
  if (!section) {
    return false;
  }

  return section.status === "completed" || section.status === "expired";
}

/** Returns true when a terminal section ended because its timer expired. */
function isTimeExpiredSection(section: NonNullable<CurrentAttempt>["section"]) {
  if (!section) {
    return false;
  }

  return section.endReason === "time-expired" || section.status === "expired";
}
