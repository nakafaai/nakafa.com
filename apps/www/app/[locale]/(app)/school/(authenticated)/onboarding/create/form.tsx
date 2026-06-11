"use client";

import { PartyIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import PhoneInput from "@repo/design-system/components/forms/phone-input";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import {
  schoolCreateDefaultValues,
  schoolCreateFormSchema,
  schoolTypeSchema,
} from "@/app/[locale]/(app)/school/(authenticated)/onboarding/create/schema";
import { reportClientException } from "@/lib/analytics/client";

/** Render the onboarding form for creating a new school. */
export function SchoolOnboardingCreateForm() {
  const t = useTranslations("School.Onboarding");
  const schoolTypeItems = schoolTypeOptions.map((option) => ({
    label: t(option.value),
    value: option.value,
  }));

  const router = useRouter();

  const createSchool = useMutation(api.schools.mutations.createSchool);

  const form = useForm({
    defaultValues: schoolCreateDefaultValues,
    validators: {
      onChange: schoolCreateFormSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const { slug } = await createSchool(value);
            router.push(`/school/${slug}`);
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "school-onboarding-create",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toastManager.add({
                    type: "error",
                    title: t("school-creation-failed"),
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
      id="school-onboarding-create-form"
    >
      <div className="flex w-full flex-col gap-3">
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-name">
                  {t("school-name")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id="school-name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("school-name-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="email">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-email">
                  {t("school-email")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id="school-email"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("school-email-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="phone">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-phone">
                  {t("school-phone")}
                </FieldLabel>
                <PhoneInput
                  aria-invalid={isInvalid}
                  id="school-phone"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(value) => {
                    if (value) {
                      field.handleChange(value);
                    }
                  }}
                  placeholder={t("school-phone-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="address">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-address">
                  {t("school-address")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id="school-address"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("school-address-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="city">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-city">
                  {t("school-city")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id="school-city"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("school-city-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="province">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-province">
                  {t("school-province")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id="school-province"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("school-province-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="type">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-type">
                  {t("school-type")}
                </FieldLabel>
                <Select
                  items={schoolTypeItems}
                  name={field.name}
                  onValueChange={(value) => {
                    const parsed =
                      Schema.decodeUnknownOption(schoolTypeSchema)(value);
                    if (Option.isSome(parsed)) {
                      field.handleChange(parsed.value);
                    }
                  }}
                  value={field.state.value ?? undefined}
                >
                  <SelectTrigger
                    aria-invalid={isInvalid}
                    className="w-full"
                    id="school-type"
                  >
                    <SelectValue placeholder={t("school-type-placeholder")} />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectGroup>
                      {schoolTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectPopup>
                </Select>
              </Field>
            );
          }}
        </form.Field>
      </div>

      <form.Subscribe
        selector={(state) => [state.isValid, state.isDirty, state.isSubmitting]}
      >
        {([isValid, isDirty, isSubmitting]) => {
          const canSubmit = Boolean(isValid) && Boolean(isDirty);
          const isDisabled = !canSubmit || Boolean(isSubmitting);
          return (
            <Button disabled={isDisabled} type="submit">
              <Spinner icon={PartyIcon} isLoading={isSubmitting} />
              {t("create")}
            </Button>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

const schoolTypeOptions = [
  {
    value: "elementary-school",
  },
  {
    value: "middle-school",
  },
  {
    value: "high-school",
  },
  {
    value: "vocational-school",
  },
  {
    value: "university",
  },
  {
    value: "other",
  },
] as const;
