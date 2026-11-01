import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { Option } from "effect";
import type { Locale } from "use-intl";
import { useTranslations } from "use-intl";
import { TryoutPageLink } from "@/components/tryout/route/link";
import {
  getTryoutPageTarget,
  type TryoutPageAddress,
} from "@/components/tryout/route/path";
import { useAnswerPress } from "@/components/tryout/runtime/start";
import type { TryoutSectionAttempt } from "@/components/tryout/runtime/types";
import { StartSectionButton } from "@/components/tryout/section/start";
import type { TryoutSummarySection } from "@/components/tryout/section/summary";
import { TryoutActionName } from "@/components/tryout/set/name";
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
      publicPath: string;
      setKey: string;
      trackKey: string;
    };
    startDestination: {
      address: TryoutPageAddress;
      /** The section whose page the start lands on; none for a set's internal entry, whose page is the set. */
      sectionKey?: string;
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
    ...(startDestination.sectionKey === undefined
      ? {}
      : { destinationSectionKey: startDestination.sectionKey }),
    // The action stands for one section, so its start opens that section: one press shows the player.
    entrySectionKey: value.section.sectionKey,
    examKey: value.set.examKey,
    locale: value.locale,
    setKey: value.set.setKey,
    setPath: value.set.publicPath,
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
  const resumeAddress = getResumeAddress(value);
  const resumeSectionKey = value.activeAttempt.resumeSectionKey;
  if (resumeAddress && resumeSectionKey) {
    return <ResumeSectionLink address={resumeAddress} />;
  }
  return (
    <StartSectionButton
      attemptId={value.activeAttempt.attemptId}
      sectionKey={value.section.sectionKey}
    />
  );
}

/** Links to the section the running attempt continues in, and takes a press that waited for the read. */
function ResumeSectionLink({ address }: { address: TryoutPageAddress }) {
  const navigate = useNavigate();
  useAnswerPress(() => {
    Option.map(getTryoutPageTarget(address), (target) => navigate(target));
  });
  return (
    <TryoutPageLink
      className={cn(buttonVariants(), "w-full sm:w-auto")}
      {...address}
    >
      <TryoutActionName name="continue-cta" />
    </TryoutPageLink>
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
