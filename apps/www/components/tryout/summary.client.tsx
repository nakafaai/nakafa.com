"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/part-summary";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { StartSectionButton } from "@/components/tryout/section-start";
import { StartTryoutButton } from "@/components/tryout/start";
import { TryoutStatus } from "@/components/tryout/status";

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

interface TryoutSectionSummaryProps {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  country: string;
  exam: string;
  locale: Locale;
  page: SectionPage;
  section: string;
  sectionFinished?: boolean;
  set: string;
  track: string;
}

interface TryoutEntrySummaryProps {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  completedAction: CompletedAction;
  locale: Locale;
  returnHref: string;
  section: TryoutSummarySection;
  sectionFinished?: boolean;
  sectionHref: string;
  set: TryoutSummarySet;
  startAttemptSectionKey?: string;
}

/** Renders the pre-runtime section summary and the correct start CTA. */
export function TryoutSectionSummary({
  activeAttempt,
  attempt,
  country,
  exam,
  locale,
  page,
  section,
  sectionFinished: sectionFinishedProp,
  set,
  track,
}: TryoutSectionSummaryProps) {
  const returnHref = getTryoutHref({ country, exam, set, track });
  const sectionHref = getTryoutHref({ country, exam, section, set, track });

  return (
    <TryoutEntrySummary
      activeAttempt={activeAttempt}
      attempt={attempt}
      completedAction="return"
      locale={locale}
      returnHref={returnHref}
      section={page.section}
      sectionFinished={sectionFinishedProp}
      sectionHref={sectionHref}
      set={page.set}
    />
  );
}

/** Renders the shared try-out section metrics and start/restart CTA card. */
export function TryoutEntrySummary({
  activeAttempt,
  attempt,
  completedAction,
  locale,
  returnHref,
  section,
  sectionFinished: sectionFinishedProp,
  sectionHref,
  set,
  startAttemptSectionKey,
}: TryoutEntrySummaryProps) {
  const tTryouts = useTranslations("Tryouts");
  const sectionAttempt = attempt?.section ?? null;
  const sectionFinished =
    sectionFinishedProp ??
    Boolean(
      sectionAttempt &&
        (sectionAttempt.status === "completed" ||
          sectionAttempt.status === "expired")
    );

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

        <TryoutPartCtas>
          <TryoutSectionCta
            activeAttempt={activeAttempt}
            attempt={attempt}
            completedAction={completedAction}
            locale={locale}
            returnHref={returnHref}
            section={section}
            sectionFinished={sectionFinished}
            sectionHref={sectionHref}
            set={set}
            startAttemptSectionKey={startAttemptSectionKey}
          />
        </TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}

/** Renders the only valid section-page CTA for the current attempt state. */
function TryoutSectionCta({
  activeAttempt,
  attempt,
  completedAction,
  locale,
  returnHref,
  section,
  sectionFinished,
  sectionHref,
  set,
  startAttemptSectionKey,
}: TryoutEntrySummaryProps & {
  sectionFinished: boolean;
}) {
  if (sectionFinished && completedAction === "return") {
    return <BackToSetLink href={returnHref} />;
  }

  if (activeAttempt && !activeAttempt.section) {
    return (
      <StartOrResumeSectionCta
        activeAttempt={activeAttempt}
        returnHref={returnHref}
        section={section}
        sectionHref={sectionHref}
      />
    );
  }

  if (activeAttempt) {
    return null;
  }

  return (
    <StartTryoutButton
      attempt={attempt}
      copy={startAttemptSectionKey ? "direct-entry" : "section-picker"}
      countryKey={set.countryKey}
      entrySectionKey={startAttemptSectionKey}
      examKey={set.examKey}
      firstSectionHref={sectionHref}
      locale={locale}
      setKey={set.setKey}
      trackKey={set.trackKey}
    />
  );
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
function StartOrResumeSectionCta({
  activeAttempt,
  returnHref,
  section,
  sectionHref,
}: {
  activeAttempt: NonNullable<CurrentAttempt>;
  returnHref: string;
  section: TryoutSummarySection;
  sectionHref: string;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (
    activeAttempt.resumeSectionKey &&
    activeAttempt.resumeSectionKey !== section.sectionKey
  ) {
    let resumeHref = returnHref;

    if (activeAttempt.resumeSectionPublicPath) {
      resumeHref = getTryoutPublicPathHref(
        activeAttempt.resumeSectionPublicPath
      );
    }

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
      attemptId={activeAttempt.attemptId}
      sectionHref={sectionHref}
      sectionKey={section.sectionKey}
    />
  );
}

/** Renders the production try-out metric number style. */
function TryoutMetricNumber({ value }: { value: number }) {
  return (
    <NumberFormatGroup>
      <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
        <NumberFormat
          format={{ maximumFractionDigits: 0 }}
          trend={0}
          value={value}
        />
      </div>
    </NumberFormatGroup>
  );
}

/** Renders the production try-out duration style. */
function TryoutMetricTime({ totalSeconds }: { totalSeconds: number }) {
  const segments = getTimeSegments(totalSeconds);

  return (
    <NumberFormatGroup>
      <div className="flex items-center gap-2 sm:gap-3">
        {segments.map((segment, index) => (
          <Fragment key={segment.label}>
            <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
              <NumberFormat
                format={{ minimumIntegerDigits: 2 }}
                trend={0}
                value={segment.value}
              />
            </div>
            {index < segments.length - 1 ? (
              <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
                :
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </NumberFormatGroup>
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
