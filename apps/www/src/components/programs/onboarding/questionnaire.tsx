"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { PartyIcon } from "@hugeicons/core-free-icons";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import {
  Questionnaire,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from "@repo/design-system/components/ui/questionnaire";
import { toast } from "@repo/design-system/lib/toast/notify";
import { redirect, useRouter } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import { useConvex } from "convex/react";
import { Array as Arr, Effect } from "effect";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { OnboardingOption } from "@/components/programs/onboarding/choice";
import { getOnboardingDestination } from "@/components/programs/onboarding/destination";
import { useSaveOnboardingAnswerMutation } from "@/components/programs/onboarding/mutation";
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
import { QuestionnaireSteps } from "@/components/shared/questionnaire";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthDestination,
  getPostAuthSignInHref,
  type PostAuthIntentResolution,
} from "@/lib/auth/admission";
import { requireConvexOnline } from "@/lib/convex/online";

/** Runs the complete resumable questionnaire inside the shared entry shell. */
export function OnboardingQuestionnaire({
  initialProfile,
  intent,
}: {
  initialProfile: OnboardingProfile;
  intent: PostAuthIntentResolution;
}) {
  const t = useTranslations("LearningPrograms");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const reactiveStatus = useQuery(onboarding.queries.getStatus, {});
  const profile = QueryResult.isSuccess(reactiveStatus)
    ? reactiveStatus.value.profile
    : initialProfile;
  const [draftAnswer, setDraftAnswer] = useState<OnboardingAnswer | null>(null);
  const answers = getOnboardingAnswers(
    draftAnswer
      ? applyOnboardingAnswer(profile, draftAnswer, profile?.updatedAt ?? 0)
      : profile
  );
  const [activeItem, setActiveItem] = useState<OnboardingItemName>(() =>
    getInitialOnboardingItem(getOnboardingAnswers(initialProfile))
  );
  const [isFinishing, startFinishTransition] = useTransition();
  const saveAnswer = useSaveOnboardingAnswerMutation(initialProfile);
  const finish = useMutation(onboarding.mutations.finish);
  const convex = useConvex();

  if (QueryResult.isFailure(reactiveStatus)) {
    throw reactiveStatus.error;
  }

  if (
    QueryResult.isSuccess(reactiveStatus) &&
    reactiveStatus.value.isAuthenticated === false &&
    !isFinishing
  ) {
    redirect({ href: getPostAuthSignInHref(intent), locale });
  }
  if (
    QueryResult.isSuccess(reactiveStatus) &&
    reactiveStatus.value.isAuthenticated === true &&
    reactiveStatus.value.isRequired === false &&
    !isFinishing
  ) {
    redirect(getPostAuthDestination(intent, locale));
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
              Effect.sync(() =>
                toast.error({
                  description: "onboarding-save-error.description",
                  title: "onboarding-save-error.title",
                })
              )
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
    setDraftAnswer(null);
    setActiveItem(nextItem);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completeAnswers = getCompleteOnboardingAnswers(answers);
    if (!completeAnswers) {
      toast.error({ title: "onboarding-invalid-selection.title" });
      return;
    }

    startFinishTransition(async () => {
      const outcome = await Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.andThen(
            finishOnboarding(finish, { answers: completeAnswers }).pipe(
              Effect.tapError((error) =>
                reportClientException(error.cause, {
                  source: "onboarding-finish",
                })
              )
            )
          ),
          Effect.match({
            onFailure: () => ({ status: "error" }) as const,
            onSuccess: (result) => ({ result, status: "success" }) as const,
          })
        )
      );
      if (outcome.status === "error") {
        toast.error({
          description: "onboarding-finish-error.description",
          title: "onboarding-finish-error.title",
        });
        return;
      }

      const destination = getOnboardingDestination(outcome.result, intent);
      startFinishTransition(() =>
        router.replace(destination.href, { locale: destination.locale })
      );
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
        aria-label={tCommon("questionnaire-progress")}
        className="flex w-full flex-col gap-2"
        render={(props, { current, total }) => (
          <div
            {...props}
            aria-valuetext={t("onboarding.progress", { current, total })}
            role="progressbar"
          >
            <div aria-hidden="true" className="grid w-full grid-cols-3 gap-2">
              {Arr.map(onboardingItems, (item, index) => (
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
          {Arr.map(roleOptions, (option) => (
            <QuestionnaireChoice
              checked={answers.role === option.value}
              key={option.value}
              onChange={(event) => {
                if (event.target.checked) {
                  setDraftAnswer({ kind: "role", value: option.value });
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
          {Arr.map(regionOptions, (option) => (
            <QuestionnaireChoice
              checked={answers.region === option.value}
              key={option.value}
              onChange={(event) => {
                if (event.target.checked) {
                  setDraftAnswer({ kind: "region", value: option.value });
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
          {Arr.map(focusOptions, (option) => (
            <QuestionnaireChoice
              checked={answers.focus === option.value}
              key={option.value}
              onChange={(event) => {
                if (event.target.checked) {
                  setDraftAnswer({ kind: "focus", value: option.value });
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

      <QuestionnaireSteps finishIcon={PartyIcon} inert={isFinishing}>
        {t("onboarding.finish")}
      </QuestionnaireSteps>
    </Questionnaire>
  );
}
