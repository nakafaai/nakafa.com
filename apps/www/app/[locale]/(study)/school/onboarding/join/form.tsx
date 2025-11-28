"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useForm } from "@tanstack/react-form";
import { MergeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as z from "zod/mini";
import { roles } from "@/lib/data/roles";

const formSchema = z.object({
  role: z.union([
    z.literal("teacher"),
    z.literal("student"),
    z.literal("parent"),
  ]),
  code: z.string().check(z.minLength(1), z.trim()),
});
const roleSchema = formSchema.shape.role;

export function SchoolOnboardingJoinForm() {
  const t = useTranslations("School.Onboarding");

  const form = useForm({
    defaultValues: {
      role: "teacher",
      code: "",
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: ({ value }) => {
      // TODO: Create school
      form.reset(value);
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      id="school-onboarding-join-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="role">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="school-onboarding-join-role">
                  {t("role")}
                </FieldLabel>
                <Select
                  name={field.name}
                  onValueChange={(value) => {
                    const parsed = roleSchema.safeParse(value);
                    if (parsed.success) {
                      field.handleChange(parsed.data);
                    }
                  }}
                  value={field.state.value ?? undefined}
                >
                  <SelectTrigger
                    aria-invalid={isInvalid}
                    className="w-full"
                    id="school-onboarding-join-role"
                  >
                    <SelectValue placeholder={t("role-placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <role.icon />
                        {t(role.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            );
          }}
        </form.Field>

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

      <form.Subscribe
        selector={(state) => [state.isValid, state.isDirty, state.isSubmitting]}
      >
        {([isValid, isDirty, isSubmitting]) => {
          const canSubmit = Boolean(isValid) && Boolean(isDirty);
          const isDisabled = !canSubmit || Boolean(isSubmitting);
          return (
            <Button disabled={isDisabled} type="submit">
              {isSubmitting ? <SpinnerIcon /> : <MergeIcon />}
              {t("join")}
            </Button>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

const roleOptions = roles.filter((role) => role.value !== "administrator");
