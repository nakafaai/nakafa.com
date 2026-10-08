"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import type { TryoutSectionAttempt } from "@/components/tryout/runtime/types";
import { StartSectionButton } from "@/components/tryout/section/start";
import type { TryoutSummarySection } from "@/components/tryout/section/summary";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

type CurrentAttempt = TryoutSectionAttempt | null;
type CompletedAction = "restart" | "return";
/** Props of the summary action: `value` is the cohesive state that selects one valid action. */
interface TryoutSummaryActionProps {
  value: {
    activeAttempt: NonNullable<CurrentAttempt> | null;
    attempt?: CurrentAttempt;
    completedAction: CompletedAction;
    locale: Locale;
    returnHref: string;
    section: TryoutSummarySection;
    sectionFinished: boolean;
    set: {
      countryKey: string;
      examKey: string;
      setKey: string;
      trackKey: string;
    };
    startAttemptSectionKey?: string;
    startDestination: {
      href: string;
      successNavigation: StartTryoutRequest["successNavigation"];
    } | null;
  };
}

/** Canonical destination and post-start behavior for one section route. */
export type TryoutStartDestination = NonNullable<
  TryoutSummaryActionProps["value"]["startDestination"]
>;

/** Props of the call to action that starts or resumes one unfinished section. */
interface StartOrResumeSectionCtaProps {
  value: {
    activeAttempt: NonNullable<CurrentAttempt>;
    returnHref: string;
    section: TryoutSummarySection;
  };
}

/** Renders the only valid action for the current section summary state. */
export function TryoutSummaryAction({ value }: TryoutSummaryActionProps) {
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
  value: Pick<
    TryoutSummaryActionProps["value"],
    "activeAttempt" | "returnHref"
  >;
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
function StartOrResumeSectionCta({ value }: StartOrResumeSectionCtaProps) {
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
function getResumeHref(value: StartOrResumeSectionCtaProps["value"]) {
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
