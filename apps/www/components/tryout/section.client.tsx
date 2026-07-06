"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutMeta } from "@/components/tryout/meta";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/part-summary";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutRuntime } from "@/components/tryout/runtime.client";
import { StartTryoutButton } from "@/components/tryout/start-button";

interface TryoutSectionPageClientProps {
  country: string;
  exam: string;
  locale: Locale;
  publicPath: string;
  section: string;
  set: string;
}

/** Renders one realtime try-out section page from Convex. */
export function TryoutSectionPageClient({
  country,
  exam,
  locale,
  publicPath,
  section,
  set,
}: TryoutSectionPageClientProps) {
  const page = useQuery(api.tryouts.queries.catalog.getSectionPage, {
    locale,
    publicPath,
  });
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    page
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
        }
      : "skip"
  );
  const runtime = useQuery(
    api.tryouts.queries.attempt.getSectionRuntime,
    page
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
        }
      : "skip"
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");

  if (!page) {
    return null;
  }

  let status = tTryouts("part-head-needs-tryout");

  if (runtime) {
    status = tTryouts("part-head-in-progress");
  } else if (attempt === undefined) {
    status = tTryouts("part-head-loading");
  } else if (attempt?.status === "in-progress") {
    status = tTryouts("part-head-ready");

    if (
      attempt.section?.status === "in-progress" &&
      attempt.section.answeredCount > 0
    ) {
      status = tTryouts("part-head-in-progress");
    }
  } else if (attempt) {
    status = tTryouts("part-head-ended");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          icon={getMaterialIcon(page.section.sectionKey)}
          link={{
            href: getTryoutHref({ country, exam, set }),
            label: tCommon("back"),
          }}
          meta={<TryoutMeta items={[page.exam.title, page.set.title]} />}
          status={status}
          title={page.section.title}
        />

        <div className="space-y-12">
          {runtime ? (
            <TryoutRuntime runtime={runtime} />
          ) : (
            <TryoutPartSummary>
              <TryoutPartBody>
                <TryoutPartLead>
                  <TryoutPartStats>
                    <TryoutPartStat label={tTryouts("part-questions-label")}>
                      <TryoutMetricNumber value={page.section.questionCount} />
                    </TryoutPartStat>

                    <TryoutPartStat label={tTryouts("part-time-label")}>
                      <TryoutMetricTime
                        totalSeconds={page.section.timeLimitSeconds}
                      />
                    </TryoutPartStat>
                  </TryoutPartStats>
                </TryoutPartLead>

                <TryoutPartCtas>
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
                </TryoutPartCtas>
              </TryoutPartBody>
            </TryoutPartSummary>
          )}
        </div>
      </div>
    </div>
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
