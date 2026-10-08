"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { publicTryoutSectionValidator } from "@repo/backend/confect/tryouts/queries/catalogModel";
import { tryoutSetIdentityValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutAttemptStateValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { Schema, Struct } from "effect";
import { useTranslations } from "next-intl";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import { StartSectionButton } from "@/components/tryout/section/start";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

const CompletedActionSchema = Schema.Literals(["restart", "return"]);

const TryoutSummarySetSchema = tryoutSetIdentityValidator.mapFields(
  Struct.pick(["countryKey", "examKey", "setKey", "trackKey"])
);

/** Minimal section contract rendered by the shared summary surface. */
const TryoutSummarySectionSchema = publicTryoutSectionValidator.mapFields(
  Struct.pick(["questionCount", "sectionKey", "timeLimitSeconds"])
);

/** Canonical destination and post-start behavior for one section route. */
const TryoutStartDestinationSchema = Schema.Struct({
  href: Schema.String,
  successNavigation: Schema.Literals(["destination", "stay"]),
});
export type TryoutStartDestination = typeof TryoutStartDestinationSchema.Type;

/** Cohesive state needed to select one valid section summary action. */
const TryoutSummaryActionValueSchema = Schema.Struct({
  activeAttempt: Schema.NullOr(tryoutAttemptStateValidator),
  attempt: Schema.optionalKey(Schema.NullOr(tryoutAttemptStateValidator)),
  completedAction: CompletedActionSchema,
  locale: AppLocaleCodeSchema,
  returnHref: Schema.String,
  section: TryoutSummarySectionSchema,
  sectionFinished: Schema.Boolean,
  set: TryoutSummarySetSchema,
  startAttemptSectionKey: Schema.optionalKey(Schema.String),
  startDestination: Schema.NullOr(TryoutStartDestinationSchema),
});
export type TryoutSummaryActionValue =
  typeof TryoutSummaryActionValueSchema.Type;

const ResumeSectionValueSchema = Schema.Struct({
  activeAttempt: tryoutAttemptStateValidator,
  returnHref: Schema.String,
  section: TryoutSummarySectionSchema,
});
type ResumeSectionValue = typeof ResumeSectionValueSchema.Type;

/** Renders the only valid action for the current section summary state. */
export function TryoutSummaryAction({
  value,
}: {
  value: TryoutSummaryActionValue;
}) {
  if (!isActiveLocale(value.locale)) {
    return null;
  }
  const startDestination = value.startDestination;
  if (value.sectionFinished && value.completedAction === "return") {
    return <TryoutReturnAction value={value} />;
  }
  if (value.activeAttempt && !value.activeAttempt.section) {
    return (
      <StartOrResumeSectionCta
        value={{
          activeAttempt: value.activeAttempt,
          returnHref: value.returnHref,
          section: value.section,
        }}
      />
    );
  }
  if (value.activeAttempt) {
    return null;
  }
  if (!startDestination) {
    return <TryoutReturnAction value={value} />;
  }
  const request: StartTryoutRequest = {
    authRedirectHref: startDestination.href,
    countryKey: value.set.countryKey,
    destinationHref: startDestination.href,
    destinationSectionKey: value.section.sectionKey,
    ...(value.startAttemptSectionKey === undefined
      ? {}
      : {
          entrySectionKey: value.startAttemptSectionKey,
        }),
    examKey: value.set.examKey,
    locale: value.locale,
    setKey: value.set.setKey,
    successNavigation: startDestination.successNavigation,
    trackKey: value.set.trackKey,
  };
  return <StartTryoutButton attempt={value.attempt} request={request} />;
}

/** Returns to the verified set destination and warms its exact state. */
function TryoutReturnAction({
  value,
}: {
  value: Pick<TryoutSummaryActionValue, "activeAttempt" | "returnHref">;
}) {
  const tTryouts = useTranslations("Tryouts");
  return (
    <IntentLink
      className={cn(buttonVariants(), "w-full sm:w-auto")}
      href={value.returnHref}
    >
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
      {tTryouts("back-to-set-cta")}
    </IntentLink>
  );
}

/** Starts a ready section or links to the active section already in progress. */
function StartOrResumeSectionCta({ value }: { value: ResumeSectionValue }) {
  const tTryouts = useTranslations("Tryouts");
  const resumeHref = getResumeHref(value);
  const resumeSectionKey = value.activeAttempt.resumeSectionKey;
  if (resumeHref && resumeSectionKey) {
    return (
      <IntentLink
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={resumeHref}
      >
        {tTryouts("continue-cta")}
      </IntentLink>
    );
  }
  return (
    <StartSectionButton
      attemptId={value.activeAttempt.attemptId}
      sectionKey={value.section.sectionKey}
    />
  );
}

/** Returns the active attempt target when it belongs to another section. */
function getResumeHref(value: ResumeSectionValue) {
  const { activeAttempt, section } = value;
  if (!activeAttempt.resumeSectionKey) {
    return null;
  }
  if (activeAttempt.resumeSectionKey === section.sectionKey) {
    return null;
  }
  if (activeAttempt.resumeSectionPublicPath) {
    return getTryoutAttemptHref(
      activeAttempt.resumeSectionPublicPath,
      activeAttempt.attemptId
    );
  }
  return value.returnHref;
}
