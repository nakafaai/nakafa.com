"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  type LearningInterest,
  LearningInterestSchema,
} from "@repo/contents/_types/program/schema";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type {
  ActiveLearningProfile,
  LearningProgramCatalog,
} from "@/components/programs/contract";
import { ChoiceControls } from "./controls";
import { SubmitControls } from "./finish";
import {
  canContinueOnboardingStep,
  getDefaultProgram,
  getInterestsForProgram,
  getProgramsForInterests,
  getSelectableInterests,
  ONBOARDING_STEPS,
  type OnboardingStep,
  parseInterests,
} from "./model";
import { ProgressDots } from "./progress";
import {
  initialOnboardingState,
  type OnboardingState,
  onboardingFormSchema,
} from "./state";
import {
  ConfirmStep,
  InterestsStep,
  ProgramStep,
  UnavailableCatalogStep,
} from "./steps";
import { submitOnboardingSelection } from "./submit";

interface LearningProgramOnboardingFormProps {
  activeProfile?: NonNullable<ActiveLearningProfile>;
  interestValues: readonly LearningInterest[];
  locale: Locale;
  programs: LearningProgramCatalog;
}

/** Renders the localized multi-step program selection flow for learners. */
export function LearningProgramOnboardingForm({
  activeProfile,
  interestValues,
  locale,
  programs,
}: LearningProgramOnboardingFormProps) {
  const t = useTranslations("LearningPrograms");
  const router = useRouter();
  const selectProgram = useMutation(
    api.learningPrograms.mutations.selectLearningProgram
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<OnboardingStep>("interests");
  const [submissionState, setSubmissionState] = useState<OnboardingState>(
    initialOnboardingState
  );
  const selectableInterests = getSelectableInterests(programs, interestValues);
  const defaultProgram = getDefaultProgram(programs);
  const form = useForm({
    defaultValues: {
      interests: [...(activeProfile?.interests ?? [])],
      primaryProgramKey: activeProfile?.program.key ?? "",
    },
    validators: {
      onChange: onboardingFormSchema,
    },
    onSubmit: async ({ value }) => {
      const nextState = await Effect.runPromise(
        submitOnboardingSelection({
          selectProgram: (formValue) =>
            selectProgram({
              interests: formValue.interests,
              locale,
              primaryProgramKey: formValue.primaryProgramKey,
            }),
          value,
        })
      );

      setSubmissionState(nextState);
      if (nextState.status === "success") {
        form.reset(value);
        router.replace("/home");
        router.refresh();
      }
    },
  });

  if (selectableInterests.length === 0) {
    return <UnavailableCatalogStep t={t} />;
  }

  /** Moves between onboarding steps while returning the focused flow to the top. */
  function goToStep(nextStep: OnboardingStep) {
    setStep(nextStep);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
    });
  }

  /** Skips explicit choices by selecting the learner-safe default program path. */
  function selectDefaultPath() {
    if (!defaultProgram) {
      return;
    }

    const defaultInterests = getInterestsForProgram(
      defaultProgram,
      selectableInterests
    );

    form.setFieldValue(
      "interests",
      defaultInterests.length > 0 ? defaultInterests : [selectableInterests[0]]
    );
    form.setFieldValue("primaryProgramKey", defaultProgram.key);
    goToStep("confirm");
  }

  /** Clears the active choice before Back so choosing the same card can advance again. */
  function goBackFrom(currentStep: OnboardingStep) {
    if (currentStep === "confirm") {
      form.setFieldValue("primaryProgramKey", "");
      goToStep("program");
      return;
    }

    form.setFieldValue("primaryProgramKey", "");
    goToStep("interests");
  }

  /** Advances from the current choice step after its required choice is present. */
  function continueFromChoiceStep(
    currentStep: Exclude<OnboardingStep, "confirm">
  ) {
    if (currentStep === "program") {
      goToStep("confirm");
      return;
    }

    goToStep("program");
  }

  return (
    <form
      action={() => form.handleSubmit()}
      className="mx-auto flex w-full max-w-5xl flex-col gap-12"
      ref={formRef}
    >
      {submissionState.status === "error" ? (
        <Alert className="mx-auto w-full max-w-xl" variant="destructive">
          <AlertDescription>
            {t(submissionState.messageKey ?? "onboarding.save-error")}
          </AlertDescription>
        </Alert>
      ) : null}

      <form.Subscribe
        selector={(state) => [state.values, state.isSubmitting] as const}
      >
        {([values, isSubmitting]) => {
          const selectedInterests = parseInterests(values.interests);
          const programsForInterests = getProgramsForInterests(
            programs,
            selectedInterests
          );
          const selectedProgram =
            programsForInterests.find(
              (program) => program.key === values.primaryProgramKey
            ) ?? null;

          return (
            <div className="flex min-h-128 flex-col justify-center gap-10">
              {step === "interests" ? (
                <form.Field name="interests">
                  {(field) => (
                    <InterestsStep
                      interestValues={selectableInterests}
                      onChange={(value) => {
                        const parsed = Schema.decodeUnknownOption(
                          Schema.Array(LearningInterestSchema).pipe(
                            Schema.mutable
                          )
                        )(value);
                        if (Option.isNone(parsed)) {
                          return;
                        }

                        field.handleChange(parsed.value);
                        form.setFieldValue("primaryProgramKey", "");
                      }}
                      t={t}
                      value={field.state.value}
                    />
                  )}
                </form.Field>
              ) : null}

              {step === "program" ? (
                <form.Field name="primaryProgramKey">
                  {(field) => (
                    <ProgramStep
                      onChange={(value) => {
                        if (value.length === 0) {
                          return;
                        }

                        field.handleChange(value);
                        goToStep("confirm");
                      }}
                      programs={programsForInterests}
                      t={t}
                      value={field.state.value}
                    />
                  )}
                </form.Field>
              ) : null}

              {step === "confirm" ? (
                <>
                  <ConfirmStep
                    interests={selectedInterests}
                    program={selectedProgram}
                    t={t}
                  />
                  <SubmitControls
                    isSubmitting={Boolean(isSubmitting)}
                    onBack={() => goBackFrom(step)}
                    t={t}
                  />
                </>
              ) : (
                <ChoiceControls
                  canContinue={canContinueOnboardingStep({
                    interests: selectedInterests,
                    program: selectedProgram,
                    step,
                  })}
                  canSkip={Boolean(defaultProgram)}
                  onBack={() => goBackFrom(step)}
                  onContinue={() => continueFromChoiceStep(step)}
                  onSkip={selectDefaultPath}
                  step={step}
                  t={t}
                />
              )}
            </div>
          );
        }}
      </form.Subscribe>

      <ProgressDots
        label={t("onboarding.progress", {
          current: ONBOARDING_STEPS.indexOf(step) + 1,
          total: ONBOARDING_STEPS.length,
        })}
        step={step}
      />
    </form>
  );
}
