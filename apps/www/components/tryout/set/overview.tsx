"use client";

import { useTranslations } from "next-intl";
import { getTryoutHref } from "@/components/tryout/route/path";
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
  const trackHref = getTryoutHref({
    country: value.route.country,
    exam: value.route.exam,
    track: value.route.track,
  });
  const setHref = getTryoutHref(value.route);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHeader
            value={{
              description:
                value.page.set.description ?? tTryouts("slug-description"),
              link: {
                href: trackHref,
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

          <TryoutSetResult setHref={setHref} value={value} />
        </div>

        <TryoutSetSections value={value} />
      </div>
    </div>
  );
}

/** Renders nested section rows only for sets that expose them. */
function TryoutSetSections({ value }: { value: TryoutSetView }) {
  const tTryouts = useTranslations("Tryouts");

  if (value.page.sections.length === 0) {
    return null;
  }

  return (
    <TryoutSectionRows
      value={{
        attempt: value.actionAttempt,
        emptyLabel: tTryouts("list-empty"),
        locale: value.route.locale,
        questionUnitLabel: tTryouts("question-unit"),
        sections: value.page.sections,
        set: value.page.set,
      }}
    />
  );
}

/** Composes the set action inside a score card only for terminal attempts. */
function TryoutSetResult({
  setHref,
  value,
}: {
  setHref: string;
  value: TryoutSetView;
}) {
  const actionValue = {
    activeAttempt: value.activeAttempt,
    currentHref: setHref,
    currentAttempt: value.actionAttempt,
    destination: value.destination,
    entrySection: value.entrySection,
    locale: value.route.locale,
    set: value.page.set,
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
        locale: value.route.locale,
        publicPath: value.page.set.publicPath,
      }}
    >
      <TryoutSetAction value={actionValue} />
    </TryoutAttemptResults>
  );
}
