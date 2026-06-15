"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RoleChoice } from "@/components/programs/onboarding/choice";
import { StepHeading } from "@/components/programs/onboarding/heading";
import {
  type getSelectableRoleOptions,
  parseOnboardingRole,
} from "@/components/programs/onboarding/model";
import type { OnboardingRole } from "@/components/programs/onboarding/options";
import { onboardingRoleFormSchema } from "@/components/programs/onboarding/state";
import { submitOnboardingRole } from "@/components/programs/onboarding/submit";

interface RoleStepFormProps {
  initialRole: OnboardingRole | null;
  options: ReturnType<typeof getSelectableRoleOptions>;
}

/** Saves the normal Nakafa role step before moving to the focus route. */
export function RoleStepForm({ initialRole, options }: RoleStepFormProps) {
  const t = useTranslations("LearningPrograms");
  const router = useRouter();
  const updateRole = useMutation(api.users.mutations.updateUserRole);
  const form = useForm({
    defaultValues: {
      role: initialRole ?? "",
    },
    validators: {
      onChange: onboardingRoleFormSchema,
    },
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

      form.reset({ role });
      router.push(`/onboarding/focus?role=${role}`);
    },
  });

  return (
    <form
      action={() => form.handleSubmit()}
      className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-y-8 px-6 py-12"
      id="program-onboarding-role-form"
    >
      <StepHeading title={t("onboarding.role-title")} />

      <form.Field name="role">
        {(field) => (
          <ToggleGroup
            className="grid w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-3"
            onValueChange={(value) => {
              const role = parseOnboardingRole(value);

              if (!role) {
                return;
              }

              field.handleChange(role);
            }}
            type="single"
            value={field.state.value}
          >
            {options.map((option) => (
              <ToggleGroupItem
                aria-label={t(option.titleKey)}
                className="h-auto min-h-0 w-full rounded-xl border bg-card p-0 text-left shadow-sm transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))] data-pressed:border-primary/60 data-pressed:bg-[color-mix(in_oklch,var(--primary)_2%,var(--background))] data-pressed:ring-1 data-pressed:ring-primary/20"
                key={option.key}
                value={option.key}
              >
                <RoleChoice option={option} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) =>
          [state.canSubmit, state.isSubmitting, state.values.role] as const
        }
      >
        {([canSubmit, isSubmitting, role]) => (
          <Button
            disabled={!(canSubmit && parseOnboardingRole(role)) || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <Spinner data-icon="inline-start" isLoading={isSubmitting} />
            ) : null}
            {t("onboarding.continue")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
