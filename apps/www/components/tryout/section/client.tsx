"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { TryoutQuestionContent } from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import {
  getTryoutFinishedSectionDescription,
  getTryoutFinishedSectionStatus,
} from "@/components/tryout/section/finished";
import { TryoutVisibleSummary } from "@/components/tryout/section/summary.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;

interface TryoutSectionPageClientProps {
  content: TryoutSectionContent;
  page: NonNullable<FunctionReturnType<SectionPageQuery>>;
  route: TryoutSectionRoute;
}

interface TryoutSectionContent {
  questions: readonly TryoutQuestionContent[];
}

interface TryoutSectionRoute {
  country: string;
  exam: string;
  locale: Locale;
  section: string;
  set: string;
  track: string;
}

/** Renders one realtime try-out section page from Convex. */
export function TryoutSectionPageClient({
  content,
  page,
  route,
}: TryoutSectionPageClientProps) {
  const runtimeArgs = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: route.locale,
    sectionKey: page.section.sectionKey,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  const attempt = useQuery(api.tryouts.queries.attempt.getCurrent, runtimeArgs);
  const runtime = useQuery(
    api.tryouts.queries.attempt.getSectionRuntime,
    runtimeArgs
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const currentAttempt = attempt;
  const now = useTryoutClock(
    currentAttempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  if (attempt === undefined || runtime === undefined) {
    return null;
  }

  const activeAttempt = getActiveTryoutAttempt(currentAttempt ?? null, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  const hasActiveSection = currentAttempt?.section?.status === "in-progress";
  const setHref = getTryoutHref({
    country: route.country,
    exam: route.exam,
    set: route.set,
    track: route.track,
  });

  if (hasActiveSection && runtimeState.kind === "none") {
    return null;
  }

  if (runtimeState.kind !== "none" && content.questions.length === 0) {
    return null;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const sectionFinished = sectionStatus !== null;
  const sectionTimeExpired = sectionStatus === "expired";
  const attemptFinished = Boolean(
    currentAttempt && currentAttempt.status !== "in-progress"
  );

  let status = tTryouts("part-head-needs-tryout");

  if (runtimeState.kind === "active") {
    status = tTryouts("part-head-in-progress");
  } else if (runtimeState.kind === "pending") {
    status = tTryouts("part-head-expiring");
  } else if (sectionFinished) {
    status = getTryoutFinishedSectionDescription({
      attemptFinished,
      sectionTimeExpired,
      tTryouts,
    });
  } else if (activeAttempt) {
    status = tTryouts("part-head-ready");
  } else if (currentAttempt) {
    status = tTryouts("part-head-ended");
  }

  let sectionContent: ReactNode;

  if (runtimeState.kind === "active" || runtimeState.kind === "pending") {
    sectionContent = (
      <TryoutRuntime
        value={{
          expired: runtimeState.kind === "pending",
          questions: content.questions,
          returnHref: setHref,
          runtime: runtimeState.runtime,
        }}
      />
    );
  } else {
    const summary = (
      <TryoutVisibleSummary
        value={{
          activeAttempt,
          attempt: actionAttempt,
          locale: route.locale,
          page,
          route,
          sectionStatus,
        }}
      />
    );

    sectionContent = summary;

    if (runtimeState.kind === "review") {
      sectionContent = (
        <>
          {summary}
          <TryoutRuntime
            value={{
              expired: true,
              questions: content.questions,
              returnHref: setHref,
              runtime: runtimeState.runtime,
            }}
          />
        </>
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          value={{
            icon: getMaterialIcon(page.section.sectionKey),
            link: {
              href: setHref,
              label: tCommon("back"),
            },
            meta: (
              <TryoutMeta
                items={[page.exam.title, page.track.title, page.set.title]}
              />
            ),
            status,
            title: page.section.title,
          }}
        />

        <div className="space-y-12">{sectionContent}</div>
      </div>
    </div>
  );
}
