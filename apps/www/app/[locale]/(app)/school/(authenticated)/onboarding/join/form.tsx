"use client";

import { useMutation } from "@confect/react";
import { InLoveIcon } from "@hugeicons/core-free-icons";
import schools from "@repo/backend/confect/_generated/refs/schools";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  schoolJoinDefaultValues,
  schoolJoinFormSchema,
} from "@/app/[locale]/(app)/school/(authenticated)/onboarding/join/schema";
import { reportClientException } from "@/lib/analytics/client";
/** Render the onboarding form for joining an existing school. */
export function SchoolOnboardingJoinForm() {
  const t = useTranslations("School.Onboarding");
  const router = useRouter();
  const joinSchool = useMutation(schools.mutations.joinSchool);
  const form = useForm({
    defaultValues: schoolJoinDefaultValues,
    validators: {
      onChange: schoolJoinFormSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise(() => joinSchool(value)).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.tap(({ slug }) =>
            Effect.sync(() => {
              router.push(`/school/${slug}`);
            })
          ),
          Effect.matchEffect({
            onFailure: (error) =>
              reportClientException(error, {
                source: "school-onboarding-join",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(t("school-joining-failed"));
                  })
                )
              ),
            onSuccess: () => Effect.void,
          })
        )
      );
    },
  });
  return (
    <form
      action={() => form.handleSubmit()}
      className="flex flex-col gap-6"
      id="school-onboarding-join-form"
    >
      <FieldGroup>
        <form.Field name="code">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-onboarding-join-code">
                  {t("code")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id="school-onboarding-join-code"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("code-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      <form.Subscribe selector={(state) => [state.isValid, state.isSubmitting]}>
        {([isValid, isSubmitting]) => {
          const canSubmit = Boolean(isValid);
          const isDisabled = !canSubmit || Boolean(isSubmitting);
          return (
            <Button disabled={isDisabled} type="submit">
              <Spinner icon={InLoveIcon} isLoading={isSubmitting} />
              {t("join")}
            </Button>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
