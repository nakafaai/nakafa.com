"use client";

import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
} from "@repo/backend/confect/tryouts/queries/catalogModel";
import { tryoutAttemptStateValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema, Struct } from "effect";
import { TryoutSetDestinationSchema } from "@/components/tryout/set/model";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

const TryoutSetActionValueSchema = Schema.Struct({
  activeAttempt: Schema.NullOr(tryoutAttemptStateValidator),
  currentAttempt: Schema.optionalKey(
    Schema.NullOr(tryoutAttemptStateValidator)
  ),
  currentHref: Schema.String,
  destination: Schema.NullOr(TryoutSetDestinationSchema),
  entrySection: Schema.NullOr(publicTryoutSectionValidator),
  locale: AppLocaleCodeSchema,
  set: publicTryoutSetValidator.mapFields(
    Struct.pick(["countryKey", "examKey", "setKey", "trackKey"])
  ),
});
export type TryoutSetActionValue = typeof TryoutSetActionValueSchema.Type;

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
    ...(entrySectionKey === undefined ? {} : { entrySectionKey }),
    examKey: value.set.examKey,
    locale: value.locale,
    setKey: value.set.setKey,
    successNavigation: "destination",
    trackKey: value.set.trackKey,
  };

  return (
    <StartTryoutButton
      attempt={value.activeAttempt ?? value.currentAttempt}
      request={request}
    />
  );
}
