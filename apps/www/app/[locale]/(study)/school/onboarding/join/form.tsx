"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { MergeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
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
type FormSchema = z.infer<typeof formSchema>;

export function SchoolOnboardingJoinForm() {
  const t = useTranslations("School.Onboarding");

  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: "teacher",
      code: "",
    } as const,
    mode: "onChange",
  });

  const onSubmit = (values: FormSchema) => {
    startTransition(() => {
      // TODO: Create school
      form.reset(values);
    });
  };

  return (
    <form
      className="flex flex-col gap-6"
      id="school-onboarding-join-form"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="role"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-onboarding-join-role">
                {t("role")}
              </FieldLabel>
              <Select
                defaultValue={field.value ?? undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  aria-invalid={fieldState.invalid}
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
          )}
        />

        <Controller
          control={form.control}
          name="code"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-onboarding-join-code">
                {t("code")}
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-onboarding-join-code"
                placeholder={t("code-placeholder")}
              />
            </Field>
          )}
        />
      </FieldGroup>

      <Button disabled={isPending || !form.formState.isValid} type="submit">
        {isPending ? <SpinnerIcon /> : <MergeIcon />}
        {t("join")}
      </Button>
    </form>
  );
}

const roleOptions = roles.filter((role) => role.value !== "administrator");
