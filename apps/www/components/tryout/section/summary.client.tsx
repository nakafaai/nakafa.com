"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/section/card";
import { StartSectionButton } from "@/components/tryout/section/start";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";
import { TryoutStatus } from "@/components/tryout/shell/status";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionPage = NonNullable<FunctionReturnType<SectionPageQuery>>;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;
type CompletedAction = "restart" | "return";

interface TryoutSummarySection {
  questionCount: number;
  sectionKey: string;
  timeLimitSeconds: number;
}

interface TryoutSummarySet {
  countryKey: string;
  examKey: string;
  setKey: string;
  trackKey: string;
}

interface TryoutSectionRoute {
  country: string;
  exam: string;
  section: string;
  set: string;
  track: string;
}

export interface TryoutVisibleSummaryValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  locale: Locale;
  page: SectionPage;
  route: TryoutSectionRoute;
  sectionFinished: boolean;
}

export interface TryoutEntrySummaryValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  locale: Locale;
  returnHref: string;
  section: TryoutSummarySection;
  sectionFinished: boolean;
  sectionHref: string;
  set: TryoutSummarySet;
  startAttemptSectionKey: string;
}

interface TryoutSummaryActionValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  completedAction: CompletedAction;
  locale: Locale;
  returnHref: string;
  section: TryoutSummarySection;
  sectionFinished: boolean;
  sectionHref: string;
  set: TryoutSummarySet;
  startAttemptSectionKey?: string;
}

interface ResumeSectionValue {
  activeAttempt: NonNullable<CurrentAttempt>;
  returnHref: string;
  section: TryoutSummarySection;
  sectionHref: string;
}

/** Renders the pre-runtime summary for a public visible section route. */
export function TryoutVisibleSummary({
  value,
}: {
  value: TryoutVisibleSummaryValue;
}) {
  const { route } = value;
  const returnHref = getTryoutHref({
    country: route.country,
    exam: route.exam,
    set: route.set,
    track: route.track,
  });
  const sectionHref = getTryoutHref(route);

  return (
    <TryoutSummaryCard
      section={value.page.section}
      sectionFinished={value.sectionFinished}
    >
      <TryoutSummaryCta
        value={{
          activeAttempt: value.activeAttempt,
          attempt: value.attempt,
          completedAction: "return",
          locale: value.locale,
          returnHref,
          section: value.page.section,
          sectionFinished: value.sectionFinished,
          sectionHref,
          set: value.page.set,
        }}
      />
    </TryoutSummaryCard>
  );
}

/** Renders the pre-runtime summary for a set with one internal entry section. */
export function TryoutEntrySummary({
  value,
}: {
  value: TryoutEntrySummaryValue;
}) {
  return (
    <TryoutSummaryCard
      section={value.section}
      sectionFinished={value.sectionFinished}
    >
      <TryoutSummaryCta
        value={{
          activeAttempt: value.activeAttempt,
          attempt: value.attempt,
          completedAction: "restart",
          locale: value.locale,
          returnHref: value.returnHref,
          section: value.section,
          sectionFinished: value.sectionFinished,
          sectionHref: value.sectionHref,
          set: value.set,
          startAttemptSectionKey: value.startAttemptSectionKey,
        }}
      />
    </TryoutSummaryCard>
  );
}

/** Renders the shared try-out section metrics and accepts composed CTAs. */
function TryoutSummaryCard({
  children,
  section,
  sectionFinished,
}: {
  children: ReactNode;
  section: TryoutSummarySection;
  sectionFinished: boolean;
}) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <TryoutPartSummary>
      <TryoutPartBody>
        <TryoutPartLead>
          {sectionFinished ? <TryoutStatus status="completed" /> : null}

          <TryoutPartStats>
            <TryoutPartStat label={tTryouts("part-questions-label")}>
              <TryoutMetricNumber value={section.questionCount} />
            </TryoutPartStat>

            <TryoutPartStat label={tTryouts("part-time-label")}>
              <TryoutMetricTime totalSeconds={section.timeLimitSeconds} />
            </TryoutPartStat>
          </TryoutPartStats>
        </TryoutPartLead>

        <TryoutPartCtas>{children}</TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}

/** Renders the only valid CTA for the current section summary state. */
function TryoutSummaryCta({ value }: { value: TryoutSummaryActionValue }) {
  if (value.sectionFinished && value.completedAction === "return") {
    return <BackToSetLink href={value.returnHref} />;
  }

  if (value.activeAttempt && !value.activeAttempt.section) {
    return (
      <StartOrResumeSectionCta
        value={{
          activeAttempt: value.activeAttempt,
          returnHref: value.returnHref,
          section: value.section,
          sectionHref: value.sectionHref,
        }}
      />
    );
  }

  if (value.activeAttempt) {
    return null;
  }

  const request: StartTryoutRequest = {
    countryKey: value.set.countryKey,
    entrySectionKey: value.startAttemptSectionKey,
    examKey: value.set.examKey,
    firstSectionHref: value.sectionHref,
    locale: value.locale,
    setKey: value.set.setKey,
    trackKey: value.set.trackKey,
  };

  return <StartTryoutButton attempt={value.attempt} request={request} />;
}

/** Sends completed visible-section pages back to their set overview. */
function BackToSetLink({ href }: { href: string }) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <Link className={cn(buttonVariants(), "w-full sm:w-auto")} href={href}>
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
      {tTryouts("back-to-set-cta")}
    </Link>
  );
}

/** Starts a ready section or links to the active section already in progress. */
function StartOrResumeSectionCta({ value }: { value: ResumeSectionValue }) {
  const tTryouts = useTranslations("Tryouts");
  const resumeHref = getResumeHref(value);

  if (resumeHref) {
    return (
      <Link
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={resumeHref}
      >
        {tTryouts("continue-cta")}
      </Link>
    );
  }

  return (
    <StartSectionButton
      attemptId={value.activeAttempt.attemptId}
      sectionHref={value.sectionHref}
      sectionKey={value.section.sectionKey}
    />
  );
}

/** Returns the active attempt target when it belongs to another section. */
function getResumeHref(value: ResumeSectionValue) {
  const { activeAttempt, section } = value;

  if (!activeAttempt.resumeSectionKey) {
    return null;
  }

  if (activeAttempt.resumeSectionKey === section.sectionKey) {
    return null;
  }

  if (activeAttempt.resumeSectionPublicPath) {
    return getTryoutPublicPathHref(activeAttempt.resumeSectionPublicPath);
  }

  return value.returnHref;
}

/** Renders the production try-out metric number style. */
function TryoutMetricNumber({ value }: { value: number }) {
  return (
    <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none">
      {value}
    </div>
  );
}

/** Renders the production try-out duration style. */
function TryoutMetricTime({ totalSeconds }: { totalSeconds: number }) {
  const segments = getTimeSegments(totalSeconds);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {segments.map((segment, index) => (
        <div className="contents" key={segment.label}>
          <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none">
            {segment.value.toString().padStart(2, "0")}
          </div>
          {index < segments.length - 1 ? (
            <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
              :
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Splits a duration into the visible time segments for the UI. */
function getTimeSegments(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      { label: "hours", value: hours },
      { label: "minutes", value: minutes },
      { label: "seconds", value: seconds },
    ] as const;
  }

  return [
    { label: "minutes", value: minutes },
    { label: "seconds", value: seconds },
  ] as const;
}
