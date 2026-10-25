import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";

import { cn } from "cn";
import type { Locale } from "use-intl";
import { useTranslations } from "use-intl";
import { TryoutPageLink } from "@/components/tryout/route/link";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
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
    returnAddress: TryoutPageAddress;
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
      address: TryoutPageAddress;
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
    returnAddress: TryoutPageAddress;
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
          returnAddress: value.returnAddress,
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
    authRedirect: startDestination.address,
    countryKey: value.set.countryKey,
    destination: startDestination.address,
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
    "activeAttempt" | "returnAddress"
  >;
}) {
  const tTryouts = useTranslations("Tryouts");
  return (
    <TryoutPageLink
      className={cn(buttonVariants(), "w-full sm:w-auto")}
      {...value.returnAddress}
    >
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
      {tTryouts("back-to-set-cta")}
    </TryoutPageLink>
  );
}

/** Starts a ready section or links to the active section already in progress. */
function StartOrResumeSectionCta({ value }: StartOrResumeSectionCtaProps) {
  const tTryouts = useTranslations("Tryouts");
  const resumeAddress = getResumeAddress(value);
  const resumeSectionKey = value.activeAttempt.resumeSectionKey;
  if (resumeAddress && resumeSectionKey) {
    return (
      <TryoutPageLink
        className={cn(buttonVariants(), "w-full sm:w-auto")}
        {...resumeAddress}
      >
        {tTryouts("continue-cta")}
      </TryoutPageLink>
    );
  }
  return (
    <StartSectionButton
      attemptId={value.activeAttempt.attemptId}
      sectionKey={value.section.sectionKey}
    />
  );
}

/** Returns the address of the active attempt when it belongs to another section. */
function getResumeAddress(
  value: StartOrResumeSectionCtaProps["value"]
): TryoutPageAddress | null {
  const { activeAttempt, section } = value;
  if (!activeAttempt.resumeSectionKey) {
    return null;
  }
  if (activeAttempt.resumeSectionKey === section.sectionKey) {
    return null;
  }
  if (activeAttempt.resumeSectionPublicPath) {
    return {
      attemptId: activeAttempt.attemptId,
      publicPath: activeAttempt.resumeSectionPublicPath,
    };
  }
  return value.returnAddress;
}
