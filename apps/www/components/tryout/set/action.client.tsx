"use client";

import type { Locale } from "next-intl";
import { TryoutCountdown } from "@/components/tryout/runtime/countdown";
import type {
  CurrentAttempt,
  SetEntrySection,
  SetPage,
  TryoutSetDestination,
} from "@/components/tryout/set/model";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

export interface TryoutSetActionValue {
  activeAttempt: CurrentAttempt | null;
  currentAttempt?: CurrentAttempt | null;
  currentHref: string;
  destination: TryoutSetDestination | null;
  entrySection: SetEntrySection | null;
  locale: Locale;
  set: Pick<SetPage["set"], "countryKey" | "examKey" | "setKey" | "trackKey">;
}

/** Renders the only valid set-page action for the current attempt state. */
export function TryoutSetAction({ value }: { value: TryoutSetActionValue }) {
  if (
    !(value.entrySection && value.destination && isActiveLocale(value.locale))
  ) {
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
    successNavigation: "destination",
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
