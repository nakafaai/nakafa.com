"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";
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
  locale: Locale;
  returnHref: string;
  section: TryoutSummarySection;
  sectionHref: string;
  set: TryoutSummarySet;
}

/** Renders the only valid action for the current section summary state. */
export function TryoutSummaryAction({
  value,
}: {
  value: TryoutSummaryActionValue;
}) {
  const tTryouts = useTranslations("Tryouts");
  const prewarmData = useTryoutDataIntent();

  if (value.sectionFinished && value.completedAction === "return") {
    return (
      <TryoutIntentLink
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
      </TryoutIntentLink>
    );
  }

  if (value.activeAttempt && !value.activeAttempt.section) {
    return (
      <StartOrResumeSectionCta
        value={{
          activeAttempt: value.activeAttempt,
          locale: value.locale,
          returnHref: value.returnHref,
          section: value.section,
          sectionHref: value.sectionHref,
          set: value.set,
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
    firstSectionKey: value.section.sectionKey,
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
  const prewarmData = useTryoutDataIntent();
  const resumeHref = getResumeHref(value);

  if (resumeHref) {
    return (
      <TryoutIntentLink
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        href={resumeHref}
        onIntent={() =>
          prewarmData({
            countryKey: value.set.countryKey,
            examKey: value.set.examKey,
            kind: "section",
            locale: value.locale,
            sectionKey:
              value.activeAttempt.resumeSectionKey ?? value.section.sectionKey,
            setKey: value.set.setKey,
            trackKey: value.set.trackKey,
          })
        }
      >
        {tTryouts("continue-cta")}
      </TryoutIntentLink>
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
    return getTryoutPublicPathHref(activeAttempt.resumeSectionPublicPath);
  }

  return value.returnHref;
}
