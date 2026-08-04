"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  type TryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import type { TryoutStartDestination } from "@/components/tryout/section/action.client";
import {
  getTryoutFinishedSectionDescription,
  getTryoutFinishedSectionStatus,
} from "@/components/tryout/section/finished";
import { TryoutVisibleSummary } from "@/components/tryout/section/summary.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;

interface TryoutSectionPageClientProps {
  binding: TryoutSectionRouteBinding;
  content: TryoutSectionAssets;
  page: NonNullable<FunctionReturnType<SectionPageQuery>>;
  route: TryoutSectionRoute;
  setHref: string;
}

type TryoutSectionRouteBinding =
  | { kind: "active" }
  | {
      attemptId: Id<"tryoutAttempts">;
      kind: "retained";
      startHref: string | null;
    };

interface TryoutSectionAssets {
  answers: readonly TryoutAnswerContent[];
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
  binding,
  content,
  page,
  route,
  setHref,
}: TryoutSectionPageClientProps) {
  const runtimeArgs = {
    ...(binding.kind === "retained" ? { attemptId: binding.attemptId } : {}),
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: route.locale,
    sectionKey: page.section.sectionKey,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  const attempt = useQuery(api.tryouts.queries.attempt.getCurrent, runtimeArgs);
  const runtime = useQuery(api.tryouts.queries.runtime.getSection, runtimeArgs);
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const now = useTryoutClock(
    attempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  if (attempt === undefined || runtime === undefined) {
    return null;
  }

  const currentAttempt = attempt;
  const activeAttempt = getActiveTryoutAttempt(currentAttempt ?? null, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  const hasActiveSection = currentAttempt?.section?.status === "in-progress";
  if (hasActiveSection && runtimeState.kind === "none") {
    return null;
  }

  if (runtimeState.kind !== "none" && content.questions.length === 0) {
    return <TryoutContentRefresh />;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const sectionFinished = sectionStatus !== null;
  const sectionTimeExpired = sectionStatus === "expired";
  const attemptFinished = Boolean(
    currentAttempt && currentAttempt.status !== "in-progress"
  );
  const startDestination = getStartDestination(binding, route);

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

        <div className="space-y-12">
          <TryoutSectionBody
            value={{
              actionAttempt,
              activeAttempt,
              content,
              page,
              route,
              runtimeState,
              sectionStatus,
              setHref,
              startDestination,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Composes active runtime, terminal summary, and review content explicitly. */
function TryoutSectionBody({
  value,
}: {
  value: {
    actionAttempt: FunctionReturnType<
      typeof api.tryouts.queries.attempt.getCurrent
    >;
    activeAttempt: NonNullable<
      FunctionReturnType<typeof api.tryouts.queries.attempt.getCurrent>
    > | null;
    content: TryoutSectionAssets;
    page: NonNullable<FunctionReturnType<SectionPageQuery>>;
    route: TryoutSectionRoute;
    runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
    sectionStatus: ReturnType<typeof getTryoutFinishedSectionStatus>;
    setHref: string;
    startDestination: TryoutStartDestination | null;
  };
}) {
  if (value.runtimeState.kind === "active") {
    return (
      <TryoutRuntime
        value={{
          answers: value.content.answers,
          expired: false,
          questions: value.content.questions,
          returnHref: value.setHref,
          runtime: value.runtimeState.runtime,
        }}
      />
    );
  }

  if (value.runtimeState.kind === "pending") {
    return (
      <TryoutRuntime
        value={{
          answers: value.content.answers,
          expired: true,
          questions: value.content.questions,
          returnHref: value.setHref,
          runtime: value.runtimeState.runtime,
        }}
      />
    );
  }

  if (value.runtimeState.kind === "review") {
    if (value.content.answers.length === 0) {
      return <TryoutContentRefresh />;
    }

    return (
      <>
        <TryoutVisibleSummary
          value={{
            activeAttempt: value.activeAttempt,
            attempt: value.actionAttempt,
            locale: value.route.locale,
            page: value.page,
            returnHref: value.setHref,
            route: value.route,
            sectionStatus: value.sectionStatus,
            startDestination: value.startDestination,
          }}
        />
        <TryoutRuntime
          value={{
            answers: value.content.answers,
            expired: true,
            questions: value.content.questions,
            returnHref: value.setHref,
            runtime: value.runtimeState.runtime,
          }}
        />
      </>
    );
  }

  return (
    <TryoutVisibleSummary
      value={{
        activeAttempt: value.activeAttempt,
        attempt: value.actionAttempt,
        locale: value.route.locale,
        page: value.page,
        returnHref: value.setHref,
        route: value.route,
        sectionStatus: value.sectionStatus,
        startDestination: value.startDestination,
      }}
    />
  );
}

/** Selects how a start action leaves an active or retained section route. */
function getStartDestination(
  binding: TryoutSectionRouteBinding,
  route: TryoutSectionRoute
): TryoutStartDestination | null {
  if (binding.kind === "active") {
    return {
      href: getTryoutHref(route),
      successNavigation: "stay",
    };
  }

  if (!binding.startHref) {
    return null;
  }

  return {
    href: binding.startHref,
    successNavigation: "destination",
  };
}
