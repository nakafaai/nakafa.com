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
import { localizeInternalHref } from "@repo/internationalization/src/href";
import type { Locale } from "@repo/internationalization/src/locale";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useConvex } from "convex/react";
import { Array as Arr, Effect, Option } from "effect";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
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
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * Where a status sends the account away from the questionnaire: a visitor to sign in, and an account
 * that has no question left to its destination. An account that must answer stays.
 */
function exitHref(
  status: { readonly isAuthenticated: boolean; readonly isRequired: boolean },
  intent: PostAuthIntentResolution,
  locale: Locale
): Option.Option<string> {
  if (!status.isAuthenticated) {
    return Option.some(
      localizeInternalHref(getPostAuthSignInHref(intent), locale)
    );
  }
  if (!status.isRequired) {
    const destination = getPostAuthDestination(intent, locale);
    return Option.some(
      localizeInternalHref(destination.href, destination.locale)
    );
  }
  return Option.none();
}

/**
 * Runs the complete resumable questionnaire inside the shared entry shell. The live status waits
 * for the session, and a status that says the account must leave sends it away with a client
 * navigation, never a redirect thrown in render, which the router would show as a broken page.
 * The regions, one line each, stand in two columns, so every question fits a laptop's screen.
 */
export function OnboardingQuestionnaire({
  initialProfile,
  intent,
}: {
  initialProfile: OnboardingProfile;
  intent: PostAuthIntentResolution;
}) {
  const t = useTranslations("LearningPrograms");
  const tCommon = useTranslations("Common");
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  // The status needs the session, which Convex learns a moment after the page draws: read before
  // that, it says the account is signed out and the page would send a signed-in learner away.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const reactiveStatus = useQuery(
    onboarding.queries.getStatus,
    isSettled ? {} : "skip"
  );
  const profile = QueryResult.isSuccess(reactiveStatus)
    ? reactiveStatus.value.profile
    : initialProfile;
  // Every answer the learner chose, one per question, stays on top of the server's profile, so an
  // earlier answer whose save has not landed yet is still chosen on the next question.
  const [draftAnswers, setDraftAnswers] = useState<readonly OnboardingAnswer[]>(
    []
  );
  const answers = getOnboardingAnswers(
    Arr.reduce(draftAnswers, profile, (current, answer) =>
      applyOnboardingAnswer(current, answer, current?.updatedAt ?? 0)
    )
  );
  const [activeItem, setActiveItem] = useState<OnboardingItemName>(() =>
    getInitialOnboardingItem(getOnboardingAnswers(initialProfile))
  );
  const [isFinishing, startFinishTransition] = useTransition();
  const saveAnswer = useSaveOnboardingAnswerMutation(initialProfile);
  const finish = useMutation(onboarding.mutations.finish);
  const convex = useConvex();
  const exitTo =
    QueryResult.isSuccess(reactiveStatus) && !isFinishing
      ? Option.getOrNull(exitHref(reactiveStatus.value, intent, locale))
      : null;

  // A status that says the account must leave sends it away with a client navigation.
  useEffect(() => {
    if (exitTo !== null) {
      navigate({ href: exitTo, replace: true });
    }
  }, [exitTo, navigate]);

  if (QueryResult.isFailure(reactiveStatus)) {
    throw reactiveStatus.error;
  }

  if (exitTo !== null) {
    return null;
  }

  /** Chooses an answer for its question, in place of the one chosen there before. */
  function choose(answer: OnboardingAnswer) {
    setDraftAnswers((current) => [
      ...Arr.filter(current, (draft) => draft.kind !== answer.kind),
      answer,
    ]);
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
        navigate({
          href: localizeInternalHref(destination.href, destination.locale),
          replace: true,
        })
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
                  choose({ kind: "role", value: option.value });
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
                  choose({ kind: "region", value: option.value });
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
                  choose({ kind: "focus", value: option.value });
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
