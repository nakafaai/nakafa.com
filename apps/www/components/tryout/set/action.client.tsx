"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { TryoutCountdown } from "@/components/tryout/runtime/countdown";
import type { TryoutSetDestination } from "@/components/tryout/set/model";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";

type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;
type SetPage = NonNullable<FunctionReturnType<SetPageQuery>>;
type SetEntrySection = NonNullable<SetPage["entrySection"]>;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

export interface TryoutSetActionValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  currentAttempt?: CurrentAttempt;
  currentHref: string;
  destination: TryoutSetDestination | null;
  entrySection: SetEntrySection | null;
  locale: Locale;
  set: Pick<SetPage["set"], "countryKey" | "examKey" | "setKey" | "trackKey">;
}

/** Renders the only valid set-page action for the current attempt state. */
export function TryoutSetAction({ value }: { value: TryoutSetActionValue }) {
  if (!(value.entrySection && value.destination)) {
    return null;
  }

  const entrySectionKey =
    value.entrySection.visibility === "internal-entry"
      ? value.entrySection.sectionKey
      : undefined;
  const request: StartTryoutRequest = {
    authRedirectHref: value.currentHref,
    countryKey: value.set.countryKey,
    destinationHref: value.destination.href,
    destinationSectionKey: value.destination.sectionKey,
    entrySectionKey,
    examKey: value.set.examKey,
    locale: value.locale,
    setKey: value.set.setKey,
    trackKey: value.set.trackKey,
  };

  if (value.activeAttempt) {
    return (
      <div>
        <TryoutCountdown
          action={
            <StartTryoutButton
              attempt={value.activeAttempt}
              request={request}
            />
          }
          expiresAt={value.activeAttempt.expiresAt}
        />
      </div>
    );
  }

  return (
    <div>
      <StartTryoutButton attempt={value.currentAttempt} request={request} />
    </div>
  );
}
