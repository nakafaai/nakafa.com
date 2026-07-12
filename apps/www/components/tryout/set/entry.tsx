"use client";

import { useTranslations } from "next-intl";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import {
  TryoutEntrySummary,
  TryoutEntrySummaryAction,
} from "@/components/tryout/section/entry.client";
import {
  getTryoutFinishedSectionDescription,
  getTryoutFinishedSectionStatus,
} from "@/components/tryout/section/finished";
import type { TryoutInternalSetView } from "@/components/tryout/set/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

/** Renders a no-nested-section set as the directly startable section surface. */
export function TryoutSetEntry({ value }: { value: TryoutInternalSetView }) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const parentHref = getTryoutHref({
    country: value.route.country,
    exam: value.route.exam,
    track: value.route.track,
  });
  const sectionAttempt =
    value.runtimeState.kind === "none"
      ? null
      : value.runtimeState.runtime.section;
  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const sectionFinished = sectionStatus !== null;
  const sectionTimeExpired = sectionStatus === "expired";
  const attemptFinished = Boolean(
    value.actionAttempt && value.actionAttempt.status !== "in-progress"
  );
  let status = tTryouts("entry-head-ready");

  if (value.runtimeState.kind === "active") {
    status = tTryouts("part-head-in-progress");
  } else if (value.runtimeState.kind === "pending") {
    status = tTryouts("part-head-expiring");
  } else if (sectionFinished) {
    status = getTryoutFinishedSectionDescription({
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
          <TryoutEntryResult value={value} />

          <TryoutEntryRuntime value={value} />
        </div>
      </div>
    </div>
  );
}

/** Renders either the direct-entry facts or one terminal attempt result. */
function TryoutEntryResult({ value }: { value: TryoutInternalSetView }) {
  const sectionAttempt =
    value.runtimeState.kind === "none"
      ? null
      : value.runtimeState.runtime.section;
  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const attempt = value.actionAttempt;

  if (!attempt?.score) {
    return (
      <TryoutEntrySummary
        value={{
          score: sectionAttempt?.score ?? null,
          section: value.entrySection,
          sectionStatus,
        }}
      >
        <TryoutEntryAction value={value} />
      </TryoutEntrySummary>
    );
  }

  return (
    <TryoutAttemptResults
      value={{
        attempt: {
          attemptId: attempt.attemptId,
          attemptNumber: attempt.attemptNumber,
          score: attempt.score,
          startedAt: attempt.startedAt,
          status: attempt.status,
        },
        locale: value.route.locale,
        publicPath: value.page.set.publicPath,
      }}
    >
      <TryoutEntryAction value={value} />
    </TryoutAttemptResults>
  );
}

/** Renders a direct-entry action only outside active runtime states. */
function TryoutEntryAction({ value }: { value: TryoutInternalSetView }) {
  if (
    value.runtimeState.kind === "active" ||
    value.runtimeState.kind === "pending"
  ) {
    return null;
  }

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
  const sectionFinished =
    getTryoutFinishedSectionStatus(sectionAttempt) !== null;

  return (
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
}

/** Renders the direct-entry question runtime when Convex has one. */
function TryoutEntryRuntime({ value }: { value: TryoutInternalSetView }) {
  if (value.runtimeState.kind === "none") {
    return null;
  }

  return (
    <TryoutRuntime
      value={{
        expired: value.runtimeState.kind !== "active",
        questions: value.content.entryQuestions,
        returnHref: getTryoutHref(value.route),
        runtime: value.runtimeState.runtime,
      }}
    />
  );
}
