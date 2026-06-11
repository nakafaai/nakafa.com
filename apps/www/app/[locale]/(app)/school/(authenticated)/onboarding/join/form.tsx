"use client";

import { InLoveIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import {
  schoolJoinDefaultValues,
  schoolJoinFormSchema,
} from "@/app/[locale]/(app)/school/(authenticated)/onboarding/join/schema";
import { reportClientException } from "@/lib/analytics/client";

/** Render the onboarding form for joining an existing school. */
export function SchoolOnboardingJoinForm() {
  const t = useTranslations("School.Onboarding");

  const router = useRouter();
  const joinSchool = useMutation(api.schools.mutations.joinSchool);

  const form = useForm({
    defaultValues: schoolJoinDefaultValues,
    validators: {
      onChange: schoolJoinFormSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const { slug } = await joinSchool(value);
            router.push(`/school/${slug}`);
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "school-onboarding-join",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toastManager.add({
                    type: "error",
                    title: t("school-joining-failed"),
                  });
                })
              )
            )
          )
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
      <div className="flex w-full flex-col gap-3">
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
      </div>

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
