"use client";

import { ArrowLeft02Icon, PartyIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { LearningProgramCatalog } from "@/components/programs/contract";
import { FocusChoice } from "@/components/programs/onboarding/choice";
import { StepHeading } from "@/components/programs/onboarding/heading";
import {
  getFocusOptionForKey,
  getFocusOptionsForRole,
  resolveFocusSelection,
} from "@/components/programs/onboarding/model";
import type {
  OnboardingFocusKey,
  OnboardingRole,
} from "@/components/programs/onboarding/options";
import { onboardingFocusFormSchema } from "@/components/programs/onboarding/state";
import {
  onboardingChoiceCardVariants,
  onboardingChoiceGridVariants,
} from "@/components/programs/onboarding/styles";
import { submitOnboardingSelection } from "@/components/programs/onboarding/submit";

interface FocusStepFormProps {
  initialFocusKey: OnboardingFocusKey | "";
  programs: LearningProgramCatalog;
  role: OnboardingRole;
}

/** Saves the selected learning focus and first program through Convex. */
export function FocusStepForm({
  initialFocusKey,
  programs,
  role,
}: FocusStepFormProps) {
  const t = useTranslations("LearningPrograms");
  const locale = useLocale();
  const router = useRouter();
  const updateRole = useMutation(api.users.mutations.updateUserRole);
  const selectProgram = useMutation(
    api.learningPrograms.mutations.selectLearningProgram
  );
  const options = getFocusOptionsForRole(role, programs);
  const form = useForm({
    defaultValues: {
      focusKey: initialFocusKey,
    },
    validators: {
      onChange: onboardingFocusFormSchema,
    },
    onSubmit: async ({ value }) => {
      const option = getFocusOptionForKey(role, value.focusKey);
      const selection = option ? resolveFocusSelection(programs, option) : null;

      if (!(option && selection)) {
        toast.error(t("onboarding.invalid-selection"));
        return;
      }

      const result = await Effect.runPromise(
        submitOnboardingSelection({
          selectProgram: (formValue) =>
            selectProgram({
              interests: formValue.interests,
              locale,
              primaryProgramKey: formValue.primaryProgramKey,
            }),
          updateRole,
          value: {
            focusKey: option.key,
            interests: selection.interests,
            primaryProgramKey: selection.program.key,
            role,
          },
        })
      );

      if (result.status === "error") {
        toast.error(t(result.messageKey ?? "onboarding.save-error"));
        return;
      }

      form.reset({ focusKey: option.key });
      router.replace("/home");
      router.refresh();
    },
  });

  if (options.length === 0) {
    return <UnavailableFocusStep />;
  }

  return (
    <form
      action={() => form.handleSubmit()}
      className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-y-8 px-6 py-12"
      id="program-onboarding-focus-form"
    >
      <StepHeading title={t(`onboarding.focus.${role}.title`)} />

      <form.Field name="focusKey">
        {(field) => (
          <section
            className={onboardingChoiceGridVariants({
              columns: options.length >= 3 ? "three" : "two",
            })}
          >
            {options.map((option) => (
              <button
                aria-label={t(option.titleKey)}
                aria-pressed={field.state.value === option.key}
                className={onboardingChoiceCardVariants({
                  selected: field.state.value === option.key,
                })}
                key={option.key}
                onClick={() => field.handleChange(option.key)}
                type="button"
              >
                <FocusChoice option={option} />
              </button>
            ))}
          </section>
        )}
      </form.Field>

      <div className="flex items-center gap-3">
        <Button
          nativeButton={false}
          render={
            <NavigationLink href="/onboarding/role">
              <HugeIcons data-icon="inline-start" icon={ArrowLeft02Icon} />
              {t("onboarding.back")}
            </NavigationLink>
          }
          type="button"
          variant="ghost"
        />
        <form.Subscribe
          selector={(state) =>
            [
              state.canSubmit,
              state.isSubmitting,
              state.values.focusKey,
            ] as const
          }
        >
          {([canSubmit, isSubmitting, focusKey]) => (
            <Button
              disabled={
                !(canSubmit && getFocusOptionForKey(role, focusKey)) ||
                isSubmitting
              }
              type="submit"
            >
              <Spinner
                data-icon="inline-start"
                icon={PartyIcon}
                isLoading={isSubmitting}
              />
              {t("onboarding.save-cta")}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

/** Gives users a safe way back when their saved role has no ready focus. */
function UnavailableFocusStep() {
  const t = useTranslations("LearningPrograms");

  return (
    <Empty className="mx-auto w-full max-w-md border">
      <EmptyHeader>
        <EmptyTitle>{t("onboarding.unavailable-title")}</EmptyTitle>
        <EmptyDescription>
          {t("onboarding.unavailable-helper")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          nativeButton={false}
          render={
            <NavigationLink href="/onboarding/role">
              <HugeIcons data-icon="inline-start" icon={ArrowLeft02Icon} />
              {t("onboarding.back")}
            </NavigationLink>
          }
          variant="secondary"
        />
      </EmptyContent>
    </Empty>
  );
}
