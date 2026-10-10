"use client";

import { useMutation } from "@confect/react";
import { PartyIcon } from "@hugeicons/core-free-icons";
import schools from "@repo/backend/confect/_generated/refs/schools";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import PhoneInput from "@repo/design-system/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useConvex } from "convex/react";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  schoolCreateDefaultValues,
  schoolCreateFormSchema,
  schoolTypeSchema,
} from "@/app/[locale]/(app)/school/(authenticated)/onboarding/create/schema";
import { reportClientException } from "@/lib/analytics/client";
import { requireConvexOnline } from "@/lib/convex/online";
/** Render the onboarding form for creating a new school. */
export function SchoolOnboardingCreateForm() {
  const t = useTranslations("School.Onboarding");
  const schoolTypeItems = Arr.map(schoolTypeOptions, (option) => ({
    label: t(option.value),
    value: option.value,
  }));
  const router = useRouter();
  const createSchool = useMutation(schools.mutations.createSchool);
  const convex = useConvex();
  const form = useForm({
    defaultValues: schoolCreateDefaultValues,
    validators: {
      onChange: schoolCreateFormSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.andThen(
            Effect.tryPromise(() => createSchool(value)).pipe(
              Effect.flatMap(Effect.fromResult),
              Effect.tapError((error) =>
                reportClientException(error, {
                  source: "school-onboarding-create",
                })
              )
            )
          ),
          Effect.tap(({ slug }) =>
            Effect.sync(() => {
              router.push(`/school/${slug}`);
            })
          ),
          Effect.matchEffect({
            onFailure: () =>
              Effect.sync(() => {
                toast.error(t("school-creation-failed"));
              }),
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
      id="school-onboarding-create-form"
    >
      <FieldGroup>
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
                  <SelectContent>
                    <SelectGroup>
                      {Arr.map(schoolTypeOptions, (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

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
