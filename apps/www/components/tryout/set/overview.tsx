"use client";

import { useTranslations } from "next-intl";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import { TryoutSetAction } from "@/components/tryout/set/action.client";
import type { TryoutSetView } from "@/components/tryout/set/model";
import { TryoutSectionRows } from "@/components/tryout/set/rows.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

/** Renders a set page that offers visible nested sections. */
export function TryoutSetOverview({ value }: { value: TryoutSetView }) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHeader
            value={{
              description:
                value.page.set.description ?? tTryouts("slug-description"),
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
              title: value.page.set.title,
            }}
          />

          <TryoutSetResult value={value} />
        </div>

        <TryoutSetSections value={value} />
      </div>
    </div>
  );
}

/** Renders nested section rows only for sets that expose them. */
function TryoutSetSections({ value }: { value: TryoutSetView }) {
  const tTryouts = useTranslations("Tryouts");

  const sections = value.sectionRoutes;
  if (sections.length === 0) {
    return null;
  }

  return (
    <TryoutSectionRows
      value={{
        attempt: value.actionAttempt,
        emptyLabel: tTryouts("list-empty"),
        questionUnitLabel: tTryouts("question-unit"),
        sections,
      }}
    />
  );
}

/** Composes the set action inside a score card only for terminal attempts. */
function TryoutSetResult({ value }: { value: TryoutSetView }) {
  const actionValue = {
    activeAttempt: value.activeAttempt,
    currentHref: value.currentHref,
    currentAttempt: value.actionAttempt,
    destination: value.start.destination,
    entrySection: value.start.entrySection,
    locale: value.route.locale,
    set: value.start.set,
  };
  const attempt = value.actionAttempt;

  if (!attempt?.score) {
    return <TryoutSetAction value={actionValue} />;
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
      <TryoutSetAction value={actionValue} />
    </TryoutAttemptResults>
  );
}
