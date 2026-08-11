"use client";

import { useTranslations } from "next-intl";
import { Suspense, use } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
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
export function TryoutSetEntry({
  content,
  value,
}: {
  content: Promise<TryoutRuntimeContent> | null;
  value: TryoutInternalSetView;
}) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
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
              href: value.returnHref,
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

          <TryoutEntryRuntime content={content} value={value} />
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
        identity: {
          countryKey: value.page.set.countryKey,
          examKey: value.page.set.examKey,
          locale: value.route.locale,
          setKey: value.page.set.setKey,
          trackKey: value.page.set.trackKey,
        },
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

  const sectionAttempt =
    value.runtimeState.kind === "none"
      ? null
      : value.runtimeState.runtime.section;
  const sectionFinished =
    getTryoutFinishedSectionStatus(sectionAttempt) !== null;
  const startEntrySection = value.start.entrySection;
  const startDestination = value.start.destination;
  if (!(startEntrySection && startDestination)) {
    return null;
  }

  return (
    <TryoutEntrySummaryAction
      value={{
        activeAttempt: value.activeAttempt,
        attempt: value.actionAttempt,
        locale: value.route.locale,
        returnHref: value.returnHref,
        section: startEntrySection,
        sectionFinished,
        set: value.start.set,
        ...(startEntrySection.visibility === "internal-entry"
          ? { startAttemptSectionKey: startEntrySection.sectionKey }
          : {}),
        startDestination: {
          href: startDestination.href,
          successNavigation:
            startEntrySection.visibility === "internal-entry"
              ? "stay"
              : "destination",
        },
      }}
    />
  );
}

/** Renders the direct-entry question runtime when Convex has one. */
function TryoutEntryRuntime({
  content,
  value,
}: {
  content: Promise<TryoutRuntimeContent> | null;
  value: TryoutInternalSetView;
}) {
  if (value.runtimeState.kind === "none") {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <TryoutEntryRuntimeContent content={content} value={value} />
    </Suspense>
  );
}

/** Resolves signed content only inside the direct-entry runtime region. */
function TryoutEntryRuntimeContent({
  content,
  value,
}: {
  content: Promise<TryoutRuntimeContent> | null;
  value: TryoutInternalSetView;
}) {
  if (value.runtimeState.kind === "none") {
    return null;
  }
  if (!content) {
    return <TryoutContentRefresh />;
  }

  const resolvedContent = use(content);
  if (resolvedContent.questions.length === 0) {
    return <TryoutContentRefresh />;
  }
  if (
    value.runtimeState.kind === "review" &&
    resolvedContent.answers.length === 0
  ) {
    return <TryoutContentRefresh />;
  }

  return (
    <TryoutRuntime
      value={{
        answers: resolvedContent.answers,
        expired: value.runtimeState.kind !== "active",
        questions: resolvedContent.questions,
        returnHref: getTryoutAttemptHref(
          value.page.set.publicPath,
          value.runtimeState.runtime.attemptId
        ),
        runtime: value.runtimeState.runtime,
      }}
    />
  );
}
