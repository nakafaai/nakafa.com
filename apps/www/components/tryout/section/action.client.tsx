"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { StartSectionButton } from "@/components/tryout/section/start";
import type { TryoutSummarySection } from "@/components/tryout/section/summary";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;
type CompletedAction = "restart" | "return";

interface TryoutSummarySet {
  countryKey: string;
  examKey: string;
  setKey: string;
  trackKey: string;
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
  sectionHref: string;
  set: TryoutSummarySet;
  startAttemptSectionKey?: string;
}

interface ResumeSectionValue {
  activeAttempt: NonNullable<CurrentAttempt>;
  returnHref: string;
  section: TryoutSummarySection;
  sectionHref: string;
}

/** Renders the only valid action for the current section summary state. */
export function TryoutSummaryAction({
  value,
}: {
  value: TryoutSummaryActionValue;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (value.sectionFinished && value.completedAction === "return") {
    return (
      <Link
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={value.returnHref}
      >
        <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
        {tTryouts("back-to-set-cta")}
      </Link>
    );
  }

  if (value.activeAttempt && !value.activeAttempt.section) {
    return (
      <StartOrResumeSectionCta
        value={{
          activeAttempt: value.activeAttempt,
          returnHref: value.returnHref,
          section: value.section,
          sectionHref: value.sectionHref,
        }}
      />
    );
  }

  if (value.activeAttempt) {
    return null;
  }

  const request: StartTryoutRequest = {
    authRedirectHref: value.sectionHref,
    countryKey: value.set.countryKey,
    entrySectionKey: value.startAttemptSectionKey,
    examKey: value.set.examKey,
    firstSectionHref: value.sectionHref,
    locale: value.locale,
    setKey: value.set.setKey,
    trackKey: value.set.trackKey,
  };

  return <StartTryoutButton attempt={value.attempt} request={request} />;
}

/** Starts a ready section or links to the active section already in progress. */
function StartOrResumeSectionCta({ value }: { value: ResumeSectionValue }) {
  const tTryouts = useTranslations("Tryouts");
  const resumeHref = getResumeHref(value);

  if (resumeHref) {
    return (
      <Link
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={resumeHref}
      >
        {tTryouts("continue-cta")}
      </Link>
    );
  }

  return (
    <StartSectionButton
      attemptId={value.activeAttempt.attemptId}
      sectionHref={value.sectionHref}
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
    return getTryoutPublicPathHref(activeAttempt.resumeSectionPublicPath);
  }

  return value.returnHref;
}
