"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { TryoutCountdown } from "@/components/tryout/countdown";
import { StartTryoutButton } from "@/components/tryout/start";

type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;
type SetPage = NonNullable<FunctionReturnType<SetPageQuery>>;
type SetEntrySection = NonNullable<SetPage["entrySection"]>;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

/** Renders the only valid set-page action for the current attempt state. */
export function TryoutSetAction({
  activeAttempt,
  countryKey,
  currentAttempt,
  entryHref,
  entrySection,
  examKey,
  locale,
  setKey,
  trackKey,
}: {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  countryKey: string;
  currentAttempt: CurrentAttempt;
  entryHref: string;
  entrySection: SetEntrySection | null;
  examKey: string;
  locale: Locale;
  setKey: string;
  trackKey: string;
}) {
  if (!entrySection) {
    return null;
  }

  const entrySectionKey =
    entrySection.visibility === "internal-entry"
      ? entrySection.sectionKey
      : undefined;

  if (activeAttempt) {
    return (
      <div>
        <TryoutCountdown
          action={
            <StartTryoutButton
              attempt={activeAttempt}
              countryKey={countryKey}
              entrySectionKey={entrySectionKey}
              examKey={examKey}
              firstSectionHref={entryHref}
              locale={locale}
              setKey={setKey}
              trackKey={trackKey}
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
        entrySectionKey={entrySectionKey}
        examKey={examKey}
        firstSectionHref={entryHref}
        locale={locale}
        setKey={setKey}
        trackKey={trackKey}
      />
    </div>
  );
}
