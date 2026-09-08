"use client";

import { useTranslations } from "next-intl";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { TryoutCountdown } from "@/components/tryout/runtime/countdown";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import { TryoutSetAction } from "@/components/tryout/set/action.client";
import type { TryoutSetView } from "@/components/tryout/set/model";
import { TryoutSectionRows } from "@/components/tryout/set/rows.client";
import {
  TryoutPageBody,
  TryoutPageHeader,
} from "@/components/tryout/shell/header";

/** Renders a set page that offers visible nested sections. */
export function TryoutSetOverview({ value }: { value: TryoutSetView }) {
  return (
    <>
      <TryoutPageHeader
        action={
          <TryoutSetAction
            value={{
              activeAttempt: value.activeAttempt,
              currentHref: value.currentHref,
              currentAttempt: value.actionAttempt,
              destination: value.start.destination,
              entrySection: value.start.entrySection,
              locale: value.route.locale,
              set: value.start.set,
            }}
          />
        }
        items={[
          {
            href:
              value.currentHref ===
              getTryoutPublicPathHref(value.page.set.publicPath)
                ? getTryoutPublicPathHref(value.page.exam.publicPath)
                : undefined,
            label: value.page.exam.title,
          },
          { href: value.returnHref, label: value.page.track.title },
        ]}
        title={value.page.set.title}
      />
      <TryoutPageBody>
        <TryoutSetResult value={value} />
        <TryoutSetSections value={value} />
      </TryoutPageBody>
    </>
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
  const attempt = value.actionAttempt;

  if (!attempt?.score) {
    return value.activeAttempt ? (
      <TryoutCountdown expiresAt={value.activeAttempt.expiresAt} />
    ) : null;
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
    />
  );
}
