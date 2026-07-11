"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import {
  TryoutEntrySummary,
  TryoutEntrySummaryAction,
} from "@/components/tryout/section/entry.client";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
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
  const sectionAttempt =
    value.runtimeState.kind === "none"
      ? null
      : value.runtimeState.runtime.section;
  const sectionFinished = isFinishedSection(sectionAttempt);
  const sectionTimeExpired = isTimeExpiredSection(sectionAttempt);
  const attemptFinished = Boolean(
    value.actionAttempt && value.actionAttempt.status !== "in-progress"
  );
  let status = tTryouts("entry-head-ready");

  if (value.runtimeState.kind === "active") {
    status = tTryouts("part-head-in-progress");
  } else if (value.runtimeState.kind === "pending") {
    status = tTryouts("part-head-expiring");
  } else if (sectionFinished) {
    status = getTryoutFinishedSectionStatus({
      attemptFinished,
      sectionTimeExpired,
      tTryouts,
    });
  }

  let summaryAction: ReactNode = (
    <TryoutEntrySummaryAction
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
  );

  if (
    value.runtimeState.kind === "active" ||
    value.runtimeState.kind === "pending"
  ) {
    summaryAction = null;
  }

  let runtimeContent: ReactNode = null;

  if (value.runtimeState.kind !== "none") {
    runtimeContent = (
      <TryoutRuntime
        value={{
          expired: value.runtimeState.kind !== "active",
          questions: value.content.entryQuestions,
          returnHref: entryHref,
          runtime: value.runtimeState.runtime,
        }}
      />
    );
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
              section: value.entrySection,
              sectionFinished,
            }}
          >
            {summaryAction}
          </TryoutEntrySummary>

          {runtimeContent}
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
