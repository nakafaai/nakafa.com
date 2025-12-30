"use client";

import { PartyIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import * as z from "zod/mini";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;

const formSchema = z.object({
  name: z
    .string()
    .check(
      z.minLength(MIN_NAME_LENGTH),
      z.maxLength(MAX_NAME_LENGTH),
      z.trim()
    ),
  email: z.string().check(z.email()),
  phone: z.string().check(z.minLength(1), z.trim()),
  address: z.string().check(z.minLength(1), z.trim()),
  city: z.string().check(z.minLength(1), z.trim()),
  province: z.string().check(z.minLength(1), z.trim()),
  type: z.union([
    z.literal("elementary-school"),
    z.literal("middle-school"),
    z.literal("high-school"),
    z.literal("vocational-school"),
    z.literal("university"),
    z.literal("other"),
  ]),
});
const typeSchema = formSchema.shape.type;

const defaultValues: z.infer<typeof formSchema> = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  type: "high-school",
};

export function SchoolOnboardingCreateForm() {
  const t = useTranslations("School.Onboarding");

  const router = useRouter();

  const createSchool = useMutation(api.schools.mutations.createSchool);

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const { slug } = await createSchool(value);
        router.push(`/school/${slug}`);
      } catch {
        toast.error(t("school-creation-failed"));
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      id="school-onboarding-create-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
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
                  name={field.name}
                  onValueChange={(value) => {
                    const parsed = typeSchema.safeParse(value);
                    if (parsed.success) {
                      field.handleChange(parsed.data);
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
                    {schoolTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.value)}
                      </SelectItem>
                    ))}
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
