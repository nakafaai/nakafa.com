"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { OnboardingChoice } from "@/components/programs/onboarding/choice";
import { StepHeading } from "@/components/programs/onboarding/heading";
import {
  type getSelectableRoleOptions,
  parseOnboardingRole,
} from "@/components/programs/onboarding/model";
import { onboardingRoleFormSchema } from "@/components/programs/onboarding/state";
import {
  getOnboardingChoiceGridColumns,
  onboardingChoiceGridVariants,
} from "@/components/programs/onboarding/styles";
import { submitOnboardingRole } from "@/components/programs/onboarding/submit";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import { useUpdateUserRoleMutation } from "@/components/user/mutation.client";
import { useUser } from "@/lib/context/use-user";

/** Saves the normal Nakafa role step from the reactive current-user role. */
export function RoleStepForm({
  options,
}: {
  options: ReturnType<typeof getSelectableRoleOptions>;
}) {
  const { currentRole, isUserPending } = useUser((state) => ({
    currentRole: parseOnboardingRole(state.user?.appUser.role),
    isUserPending: state.isPending,
  }));

  if (isUserPending) {
    return null;
  }

  return (
    <RoleStepFormBody
      currentRole={currentRole ?? ""}
      key={currentRole ?? "none"}
      options={options}
    />
  );
}

/** Owns the role-step form state for one reactive Convex role snapshot. */
function RoleStepFormBody({
  currentRole,
  options,
}: {
  currentRole: ReturnType<typeof parseOnboardingRole> | "";
  options: ReturnType<typeof getSelectableRoleOptions>;
}) {
  const t = useTranslations("LearningPrograms");
  const router = useRouter();
  const updateRole = useUpdateUserRoleMutation();
  const form = useForm({
    defaultValues: {
      role: currentRole,
    },
    validators: {
      onChange: onboardingRoleFormSchema,
    },
    /** Saves the chosen role so the next step reads the same value from reactive Convex state. */
    onSubmit: async ({ value }) => {
      const role = parseOnboardingRole(value.role);

      if (!role) {
        toast.error(t("onboarding.invalid-selection"));
        return;
      }

      const result = await Effect.runPromise(
        submitOnboardingRole({
          updateRole,
          value: {
            role,
          },
        })
      );

      if (result.status === "error") {
        toast.error(t(result.messageKey ?? "onboarding.save-error"));
        return;
      }

      router.push("/onboarding/focus");
    },
  });

  return (
    <form
      action={() => form.handleSubmit()}
      className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-y-8 px-6 py-12"
      id="program-onboarding-role-form"
    >
      <StepHeading title={t("onboarding.role-title")} />

      <form.Field name="role">
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

      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
          role: state.values.role,
        })}
      >
        {({ canSubmit, isSubmitting, role }) => (
          <Button
            disabled={!(canSubmit && parseOnboardingRole(role)) || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <Spinner data-icon="inline-start" isLoading={isSubmitting} />
            ) : null}
            {t("onboarding.continue")}
            {isSubmitting ? null : (
              <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
            )}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
