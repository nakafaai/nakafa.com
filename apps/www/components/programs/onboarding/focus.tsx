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
import type {
  ActiveLearningProfile,
  LearningProgramCatalog,
} from "@/components/programs/contract";
import { OnboardingChoice } from "@/components/programs/onboarding/choice";
import { StepHeading } from "@/components/programs/onboarding/heading";
import {
  getFocusOptionForKey,
  getFocusOptionsForRole,
  getInitialFocusKey,
  parseOnboardingRole,
  resolveFocusSelection,
} from "@/components/programs/onboarding/model";
import { onboardingFocusFormSchema } from "@/components/programs/onboarding/state";
import {
  getOnboardingChoiceGridColumns,
  onboardingChoiceGridVariants,
} from "@/components/programs/onboarding/styles";
import { submitOnboardingSelection } from "@/components/programs/onboarding/submit";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import { useUpdateUserRoleMutation } from "@/components/user/mutation.client";
import { useUser } from "@/lib/context/use-user";

/** Saves the selected learning focus for the latest reactive onboarding role. */
export function FocusStepForm({
  activeProfile,
  programs,
}: {
  activeProfile: ActiveLearningProfile;
  programs: LearningProgramCatalog;
}) {
  const { isUserPending, role } = useUser((state) => ({
    isUserPending: state.isPending,
    role: parseOnboardingRole(state.user?.appUser.role),
  }));
  const options = role ? getFocusOptionsForRole(role, programs) : [];
  const initialFocusKey = role
    ? getInitialFocusKey({ activeProfile, programs, role })
    : "";

  if (isUserPending) {
    return null;
  }

  if (!role) {
    return <UnavailableFocusStep />;
  }

  const selectedRole = role;

  if (options.length === 0) {
    return <UnavailableFocusStep />;
  }

  return (
    <FocusStepFormBody
      initialFocusKey={initialFocusKey}
      key={`${selectedRole}:${initialFocusKey}`}
      options={options}
      programs={programs}
      selectedRole={selectedRole}
    />
  );
}

/** Owns focus-step form state for one reactive role and profile snapshot. */
function FocusStepFormBody({
  initialFocusKey,
  options,
  programs,
  selectedRole,
}: {
  initialFocusKey: ReturnType<typeof getInitialFocusKey>;
  options: ReturnType<typeof getFocusOptionsForRole>;
  programs: LearningProgramCatalog;
  selectedRole: NonNullable<ReturnType<typeof parseOnboardingRole>>;
}) {
  const t = useTranslations("LearningPrograms");
  const locale = useLocale();
  const router = useRouter();
  const updateRole = useUpdateUserRoleMutation();
  const selectProgram = useMutation(
    api.learningPrograms.mutations.selectLearningProgram
  );
  const form = useForm({
    defaultValues: {
      focusKey: initialFocusKey,
    },
    validators: {
      onChange: onboardingFocusFormSchema,
    },
    /** Persists the selected focus against the latest reactive role before leaving onboarding. */
    onSubmit: async ({ value }) => {
      const option = getFocusOptionForKey(selectedRole, value.focusKey);
      const selection = option ? resolveFocusSelection(programs, option) : null;

      if (!(option && selection)) {
        toast.error(t("onboarding.invalid-selection"));
        return;
      }

      const result = await Effect.runPromise(
        submitOnboardingSelection({
          /** Writes the locale-scoped learning-program choice through Convex after form validation. */
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
            role: selectedRole,
          },
        })
      );

      if (result.status === "error") {
        toast.error(t(result.messageKey ?? "onboarding.save-error"));
        return;
      }

      router.replace("/home");
      router.refresh();
    },
  });

  return (
    <form
      action={() => form.handleSubmit()}
      className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-y-8 px-6 py-12"
      id="program-onboarding-focus-form"
    >
      <StepHeading title={t(`onboarding.focus.${selectedRole}.title`)} />

      <form.Field name="focusKey">
        {(field) => (
          <section
            className={onboardingChoiceGridVariants({
              columns: getOnboardingChoiceGridColumns(options.length),
            })}
          >
            {options.map((option) => (
              <button
                aria-label={t(option.titleKey)}
                aria-pressed={field.state.value === option.key}
                className={choiceCardVariants({
                  selected: field.state.value === option.key,
                })}
                key={option.key}
                onClick={() => field.handleChange(option.key)}
                type="button"
              >
                <OnboardingChoice option={option} />
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
          selector={(state) => ({
            canSubmit: state.canSubmit,
            focusKey: state.values.focusKey,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, focusKey, isSubmitting }) => (
            <Button
              disabled={
                !(canSubmit && getFocusOptionForKey(selectedRole, focusKey)) ||
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
