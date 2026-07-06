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
import { getTryoutHref } from "@/components/tryout/routes";
import {
  StartSectionButton,
  StartTryoutButton,
} from "@/components/tryout/start-button";
import { TryoutStatus } from "@/components/tryout/status";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionPage = NonNullable<FunctionReturnType<SectionPageQuery>>;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

interface TryoutSectionSummaryProps {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt: CurrentAttempt;
  country: string;
  exam: string;
  locale: Locale;
  page: SectionPage;
  section: string;
  sectionFinished?: boolean;
  set: string;
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
}: TryoutSectionSummaryProps) {
  const tTryouts = useTranslations("Tryouts");
  const returnHref = getTryoutHref({ country, exam, set });
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
              <TryoutMetricNumber value={page.section.questionCount} />
            </TryoutPartStat>

            <TryoutPartStat label={tTryouts("part-time-label")}>
              <TryoutMetricTime totalSeconds={page.section.timeLimitSeconds} />
            </TryoutPartStat>
          </TryoutPartStats>
        </TryoutPartLead>

        <TryoutPartCtas>
          <TryoutSectionCta
            activeAttempt={activeAttempt}
            attempt={attempt}
            country={country}
            exam={exam}
            locale={locale}
            page={page}
            returnHref={returnHref}
            section={section}
            sectionFinished={sectionFinished}
            set={set}
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
  country,
  exam,
  locale,
  page,
  returnHref,
  section,
  sectionFinished,
  set,
}: TryoutSectionSummaryProps & {
  returnHref: string;
  sectionFinished: boolean;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (sectionFinished) {
    return (
      <Link
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={returnHref}
      >
        <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
        {tTryouts("back-to-set-cta")}
      </Link>
    );
  }

  if (activeAttempt && !activeAttempt.section) {
    return (
      <StartSectionButton
        attemptId={activeAttempt.attemptId}
        sectionKey={page.section.sectionKey}
      />
    );
  }

  if (activeAttempt) {
    return null;
  }

  return (
    <StartTryoutButton
      attempt={attempt}
      countryKey={page.set.countryKey}
      examKey={page.set.examKey}
      firstSectionHref={getTryoutHref({
        country,
        exam,
        section,
        set,
      })}
      locale={locale}
      setKey={page.set.setKey}
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
