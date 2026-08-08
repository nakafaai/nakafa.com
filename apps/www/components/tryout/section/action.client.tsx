"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import {
  getTryoutAttemptHref,
  getTryoutPublicPath,
} from "@/components/tryout/route/path";
import type { TryoutSectionAttempt } from "@/components/tryout/runtime/types";
import { StartSectionButton } from "@/components/tryout/section/start";
import type { TryoutSummarySection } from "@/components/tryout/section/summary";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";

type CurrentAttempt = TryoutSectionAttempt | null;
type CompletedAction = "restart" | "return";

interface TryoutSummarySet {
  countryKey: string;
  examKey: string;
  setKey: string;
  trackKey: string;
}

/** Canonical destination and post-start behavior for one section route. */
export interface TryoutStartDestination {
  href: string;
  successNavigation: StartTryoutRequest["successNavigation"];
}

/** Cohesive state needed to select one valid section summary action. */
export interface TryoutSummaryActionValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  completedAction: CompletedAction;
  locale: Locale;
  returnHref: string;
  section: TryoutSummarySection;
  sectionFinished: boolean;
  set: TryoutSummarySet;
  startAttemptSectionKey?: string;
  startDestination: TryoutStartDestination | null;
}

interface ResumeSectionValue {
  activeAttempt: NonNullable<CurrentAttempt>;
  locale: Locale;
  returnHref: string;
  section: TryoutSummarySection;
}

/** Renders the only valid action for the current section summary state. */
export function TryoutSummaryAction({
  value,
}: {
  value: TryoutSummaryActionValue;
}) {
  const tTryouts = useTranslations("Tryouts");
  const prewarmData = useTryoutDataIntent();
  const startDestination = value.startDestination;
  const returnAction = (
    <IntentLink
      className={cn(buttonVariants(), "w-full sm:w-auto")}
      href={value.returnHref}
      onIntent={() =>
        prewarmData({
          kind: "set",
          locale: value.locale,
          publicPath: value.returnHref.slice(1),
        })
      }
    >
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
      {tTryouts("back-to-set-cta")}
    </IntentLink>
  );

  if (value.sectionFinished && value.completedAction === "return") {
    return returnAction;
  }

  if (value.activeAttempt && !value.activeAttempt.section) {
    return (
      <StartOrResumeSectionCta
        value={{
          activeAttempt: value.activeAttempt,
          locale: value.locale,
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
    return returnAction;
  }

  const request: StartTryoutRequest = {
    authRedirectHref: startDestination.href,
    countryKey: value.set.countryKey,
    destinationHref: startDestination.href,
    destinationSectionKey: value.section.sectionKey,
    entrySectionKey: value.startAttemptSectionKey,
    examKey: value.set.examKey,
    locale: value.locale,
    setKey: value.set.setKey,
    successNavigation: startDestination.successNavigation,
    trackKey: value.set.trackKey,
  };

  return <StartTryoutButton attempt={value.attempt} request={request} />;
}

/** Starts a ready section or links to the active section already in progress. */
function StartOrResumeSectionCta({ value }: { value: ResumeSectionValue }) {
  const tTryouts = useTranslations("Tryouts");
  const prewarmData = useTryoutDataIntent();
  const resumeHref = getResumeHref(value);

  if (resumeHref) {
    return (
      <IntentLink
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={resumeHref}
        onIntent={() =>
          prewarmData({
            attemptId: value.activeAttempt.attemptId,
            kind: "section",
            locale: value.locale,
            publicPath: getTryoutPublicPath(resumeHref),
          })
        }
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
