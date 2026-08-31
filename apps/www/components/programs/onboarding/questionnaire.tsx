"use client";

import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  PartyIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@repo/design-system/components/ui/questionnaire";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { redirect, useRouter } from "@repo/internationalization/src/navigation";
import { useMutation, useQuery } from "convex/react";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { OnboardingOption } from "@/components/programs/onboarding/choice";
import { getOnboardingDestinationHref } from "@/components/programs/onboarding/destination";
import { useSaveOnboardingAnswerMutation } from "@/components/programs/onboarding/mutation.client";
import {
  focusOptions,
  isOnboardingItemName,
  type OnboardingAnswer,
  type OnboardingItemName,
  onboardingItems,
  regionOptions,
  roleOptions,
} from "@/components/programs/onboarding/options";
import {
  applyOnboardingAnswer,
  getCompleteOnboardingAnswers,
  getInitialOnboardingItem,
  getOnboardingAnswer,
  getOnboardingAnswers,
  type OnboardingProfile,
} from "@/components/programs/onboarding/state";
import {
  finishOnboarding,
  saveOnboardingDraft,
} from "@/components/programs/onboarding/submit";
import { reportClientException } from "@/lib/analytics/client";

/** Runs the complete resumable questionnaire inside the shared entry shell. */
export function OnboardingQuestionnaire({
  initialProfile,
}: {
  initialProfile: OnboardingProfile;
}) {
  const t = useTranslations("LearningPrograms");
  const locale = useLocale();
  const router = useRouter();
  const reactiveStatus = useQuery(api.onboarding.queries.getStatus, {});
  const profile =
    reactiveStatus === undefined ? initialProfile : reactiveStatus.profile;
  const [pendingAnswer, setPendingAnswer] = useState<OnboardingAnswer | null>(
    null
  );
  const answers = getOnboardingAnswers(
    pendingAnswer
      ? applyOnboardingAnswer(profile, pendingAnswer, profile?.updatedAt ?? 0)
      : profile
  );
  const [activeItem, setActiveItem] = useState<OnboardingItemName>(() =>
    getInitialOnboardingItem(getOnboardingAnswers(initialProfile))
  );
  const [isFinishing, setIsFinishing] = useState(false);
  const saveAnswer = useSaveOnboardingAnswerMutation(initialProfile);
  const finish = useMutation(api.onboarding.mutations.finish);

  if (reactiveStatus?.isRequired === false && !isFinishing) {
    redirect({ href: "/home", locale });
  }

  function persistDraft(item: OnboardingItemName) {
    const answer = getOnboardingAnswer(item, answers);
    if (!answer) {
      return;
    }

    Effect.runFork(
      saveOnboardingDraft(saveAnswer, { answer }).pipe(
        Effect.catchTag("OnboardingMutationError", (error) =>
          reportClientException(error.cause, {
            source: "onboarding-draft",
          }).pipe(
            Effect.tap(() =>
              Effect.sync(() => toast.error(t("onboarding.save-error")))
            )
          )
        )
      )
    );
  }

  function handleItemChange(nextItem: string) {
    if (!isOnboardingItemName(nextItem)) {
      return;
    }
    persistDraft(activeItem);
    setPendingAnswer(null);
    setActiveItem(nextItem);
  }

  function updateAnswer(answer: OnboardingAnswer) {
    setPendingAnswer(answer);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completeAnswers = getCompleteOnboardingAnswers(answers);
    if (!completeAnswers) {
      toast.error(t("onboarding.invalid-selection"));
      return;
    }

    setIsFinishing(true);
    const outcome = await Effect.runPromise(
      finishOnboarding(finish, { answers: completeAnswers }).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            reportClientException(error.cause, {
              source: "onboarding-finish",
            }).pipe(Effect.as({ status: "error" } as const)),
          onSuccess: (result) =>
            Effect.succeed({ result, status: "success" } as const),
        })
      )
    );
    if (outcome.status === "error") {
      setIsFinishing(false);
      toast.error(t("onboarding.finish-error"));
      return;
    }

    router.replace(getOnboardingDestinationHref(outcome.result), {
      locale: outcome.result.locale,
    });
  }

  return (
    <Questionnaire
      className="w-full max-w-md"
      item={activeItem}
      items={onboardingItems}
      onItemChange={handleItemChange}
      onSubmit={handleSubmit}
      shortcuts="letters"
    >
      <QuestionnaireProgress
        className="flex w-full flex-col gap-2"
        render={(props, { current, total }) => (
          <div {...props}>
            <div aria-hidden="true" className="grid w-full grid-cols-3 gap-2">
              {onboardingItems.map((item, index) => (
                <span
                  className={cn(
                    "h-1 rounded-full bg-muted transition-colors",
                    index < current && "bg-primary"
                  )}
                  key={item.name}
                />
              ))}
            </div>
            <span>
              {t("onboarding.progress", {
                current,
                total,
              })}
            </span>
          </div>
        )}
      />

      <QuestionnaireItem name="role" required>
        <QuestionnaireTitle>{t("onboarding.role-title")}</QuestionnaireTitle>
        <QuestionnaireChoices>
          {roleOptions.map((option) => (
            <QuestionnaireChoice
              checked={answers.role === option.value}
              key={option.value}
              onChange={(event) => {
                if (event.target.checked) {
                  updateAnswer({ kind: "role", value: option.value });
                }
              }}
              value={option.value}
            >
              <OnboardingOption option={option} />
            </QuestionnaireChoice>
          ))}
        </QuestionnaireChoices>
        <QuestionnaireError>
          {t("onboarding.required-error")}
        </QuestionnaireError>
      </QuestionnaireItem>

      <QuestionnaireItem name="region" required>
        <QuestionnaireTitle>{t("onboarding.region-title")}</QuestionnaireTitle>
        <QuestionnaireDescription>
          {t("onboarding.region-description")}
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          {regionOptions.map((option) => (
            <QuestionnaireChoice
              checked={answers.region === option.value}
              key={option.value}
              onChange={(event) => {
                if (event.target.checked) {
                  updateAnswer({ kind: "region", value: option.value });
                }
              }}
              value={option.value}
            >
              <OnboardingOption option={option} />
            </QuestionnaireChoice>
          ))}
        </QuestionnaireChoices>
        <QuestionnaireError>
          {t("onboarding.required-error")}
        </QuestionnaireError>
      </QuestionnaireItem>

      <QuestionnaireItem name="focus" required>
        <QuestionnaireTitle>{t("onboarding.focus-title")}</QuestionnaireTitle>
        <QuestionnaireChoices>
          {focusOptions.map((option) => (
            <QuestionnaireChoice
              checked={answers.focus === option.value}
              key={option.value}
              onChange={(event) => {
                if (event.target.checked) {
                  updateAnswer({ kind: "focus", value: option.value });
                }
              }}
              value={option.value}
            >
              <OnboardingOption option={option} />
            </QuestionnaireChoice>
          ))}
        </QuestionnaireChoices>
        <QuestionnaireError>
          {t("onboarding.required-error")}
        </QuestionnaireError>
      </QuestionnaireItem>

      <QuestionnaireActions>
        <QuestionnairePrevious
          disabled={isFinishing}
          size="default"
          variant="ghost"
        >
          <HugeIcons data-icon="inline-start" icon={ArrowLeft02Icon} />
          {t("onboarding.back")}
        </QuestionnairePrevious>
        <QuestionnaireNext
          disabled={isFinishing}
          size="default"
          variant="default"
        >
          {t("onboarding.continue")}
          <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
        </QuestionnaireNext>
        <QuestionnaireSubmit
          disabled={isFinishing}
          size="default"
          variant="default"
        >
          <Spinner
            data-icon="inline-start"
            icon={PartyIcon}
            isLoading={isFinishing}
          />
          {t("onboarding.finish")}
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}
