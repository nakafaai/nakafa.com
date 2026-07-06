"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { isTryoutActive } from "@/components/tryout/active";
import { useTryoutClock } from "@/components/tryout/clock";
import { TryoutCountdown } from "@/components/tryout/countdown";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutList } from "@/components/tryout/list";
import { TryoutMeta } from "@/components/tryout/meta";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { StartTryoutButton } from "@/components/tryout/start-button";

interface TryoutSetPageClientProps {
  country: string;
  exam: string;
  locale: Locale;
  publicPath: string;
}

type SetPage = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.catalog.getSetPage>
>;
type SetSection = SetPage["sections"][number];
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  country,
  exam,
  locale,
  publicPath,
}: TryoutSetPageClientProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const page = useQuery(api.tryouts.queries.catalog.getSetPage, {
    locale,
    publicPath,
  });
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    page && isAuthenticated && !isLoading
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          setKey: page.set.setKey,
        }
      : "skip"
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const currentAttempt = isAuthenticated ? (attempt ?? null) : null;
  const now = useTryoutClock(currentAttempt?.status === "in-progress");

  if (!page || isLoading || (isAuthenticated && attempt === undefined)) {
    return null;
  }

  const firstSection = page.sections[0];
  let activeAttempt: typeof currentAttempt = null;

  if (
    currentAttempt &&
    isTryoutActive({
      expiresAt: currentAttempt.expiresAt,
      now,
      status: currentAttempt.status,
    })
  ) {
    activeAttempt = currentAttempt;
  }

  const resumeSectionKey = activeAttempt?.resumeSectionKey ?? null;
  const resumeSection =
    page.sections.find(
      (sectionItem) => sectionItem.sectionKey === resumeSectionKey
    ) ?? firstSection;
  const entryHref = resumeSection
    ? getTryoutPublicPathHref(resumeSection.publicPath)
    : getTryoutHref({ country, exam, set: page.set.setKey });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHeader
            description={page.set.description ?? tTryouts("slug-description")}
            link={{
              href: getTryoutHref({ country, exam }),
              label: tCommon("back"),
            }}
            meta={<TryoutMeta items={[page.exam.title, page.set.title]} />}
            title={page.set.title}
          />

          <TryoutSetAction
            activeAttempt={activeAttempt}
            countryKey={page.set.countryKey}
            currentAttempt={currentAttempt}
            entryHref={entryHref}
            examKey={page.set.examKey}
            firstSection={firstSection}
            locale={locale}
            setKey={page.set.setKey}
          />
        </div>

        <TryoutSectionRows
          attempt={currentAttempt}
          emptyLabel={tTryouts("list-empty")}
          now={now}
          questionUnitLabel={tTryouts("question-unit")}
          sections={page.sections}
        />
      </div>
    </div>
  );
}

/** Renders the only valid set-page action for the current attempt state. */
function TryoutSetAction({
  activeAttempt,
  countryKey,
  currentAttempt,
  entryHref,
  examKey,
  firstSection,
  locale,
  setKey,
}: {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  countryKey: string;
  currentAttempt: CurrentAttempt;
  entryHref: string;
  examKey: string;
  firstSection: SetSection | undefined;
  locale: Locale;
  setKey: string;
}) {
  if (!firstSection) {
    return null;
  }

  if (activeAttempt) {
    return (
      <div>
        <TryoutCountdown
          action={
            <StartTryoutButton
              attempt={activeAttempt}
              countryKey={countryKey}
              examKey={examKey}
              firstSectionHref={entryHref}
              locale={locale}
              setKey={setKey}
            />
          }
          expiresAt={activeAttempt.expiresAt}
        />
      </div>
    );
  }

  return (
    <div>
      <StartTryoutButton
        attempt={currentAttempt}
        countryKey={countryKey}
        examKey={examKey}
        firstSectionHref={entryHref}
        locale={locale}
        setKey={setKey}
      />
    </div>
  );
}

/** Renders the production-style divided section list for one set page. */
function TryoutSectionRows({
  attempt,
  emptyLabel,
  now,
  questionUnitLabel,
  sections,
}: {
  attempt: FunctionReturnType<typeof api.tryouts.queries.attempt.getCurrent>;
  emptyLabel: string;
  now: number;
  questionUnitLabel: string;
  sections: readonly SetSection[];
}) {
  let activeAttempt: typeof attempt = null;

  if (
    attempt &&
    isTryoutActive({
      expiresAt: attempt.expiresAt,
      now,
      status: attempt.status,
    })
  ) {
    activeAttempt = attempt;
  }

  const completedSections = new Set(activeAttempt?.completedSectionKeys ?? []);
  const currentSectionKey = activeAttempt?.resumeSectionKey ?? null;

  return (
    <TryoutList
      emptyLabel={emptyLabel}
      rows={sections.map((section) => ({
        current: section.sectionKey === currentSectionKey,
        description: `${section.questionCount} ${questionUnitLabel}`,
        href: getTryoutPublicPathHref(section.publicPath),
        icon: getMaterialIcon(section.sectionKey),
        iconKey: section.sectionKey,
        key: section.sectionKey,
        status: completedSections.has(section.sectionKey)
          ? "completed"
          : undefined,
        title: section.title,
      }))}
    />
  );
}
