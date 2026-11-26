import type { Locale } from "use-intl";
import type {
  CurrentAttempt,
  SetEntrySection,
  SetPage,
  TryoutSetDestination,
} from "@/components/tryout/set/model";
import type { StartTryoutRequest } from "@/components/tryout/set/start";
import { StartTryoutButton } from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

interface TryoutSetActionProps {
  value: {
    activeAttempt: CurrentAttempt | null;
    currentAttempt?: CurrentAttempt | null;
    currentPath: string;
    destination: TryoutSetDestination | null;
    entrySection: SetEntrySection | null;
    locale: Locale;
    set: Pick<
      SetPage["set"],
      "countryKey" | "examKey" | "publicPath" | "setKey" | "trackKey"
    >;
  };
}

/** Selects the section fields for a set start request without nested ternaries. */
function resolveSectionTarget(input: {
  readonly destination: TryoutSetDestination;
  readonly entrySection: SetEntrySection;
  readonly hasActiveAttempt: boolean;
}) {
  if (input.entrySection.visibility === "internal-entry") {
    return {
      entryPart: input.destination.part,
      entrySectionKey: input.entrySection.sectionKey,
    };
  }
  if (input.hasActiveAttempt) {
    return { destinationPart: input.destination.part };
  }
  return {};
}

/** Renders the only valid set-page action for the current attempt state. */
export function TryoutSetAction({ value }: TryoutSetActionProps) {
  if (
    !(value.entrySection && value.destination && isActiveLocale(value.locale))
  ) {
    return null;
  }

  const hasActiveAttempt = value.activeAttempt?.status === "in-progress";
  const sectionTarget = resolveSectionTarget({
    destination: value.destination,
    entrySection: value.entrySection,
    hasActiveAttempt,
  });
  const request: StartTryoutRequest = {
    authRedirect: { publicPath: value.currentPath },
    countryKey: value.set.countryKey,
    // Multi-section sets open an unlocked 24-hour lobby on the set page with zero running section
    // clocks so learners choose which part to start and when. Once an attempt is active, continuing
    // targets the running or next unfinished part. Single-section internal-entry sets start their one
    // paper directly after transparent confirmation of question count and duration.
    destination: hasActiveAttempt
      ? value.destination.address
      : { publicPath: value.set.publicPath },
    ...sectionTarget,
    examKey: value.set.examKey,
    locale: value.locale,
    setKey: value.set.setKey,
    setPath: value.set.publicPath,
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
