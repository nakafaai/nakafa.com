"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { AppUser } from "@repo/backend/convex/auth";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import * as z from "zod/mini";
import { FormBlock } from "@/components/shared/form-block";
import { roles } from "@/lib/data/roles";

const formSchema = z.object({
  role: z.union([
    z.literal("teacher"),
    z.literal("student"),
    z.literal("parent"),
    z.literal("administrator"),
  ]),
});
const roleSchema = formSchema.shape.role;

export function UserSettingsRole({ user }: { user: AppUser }) {
  const t = useTranslations("Auth");

  const updateUserRole = useMutation(api.users.mutations.updateUserRole);

  const form = useForm({
    defaultValues: {
      role: user.appUser.role,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      const { role } = value;
      if (!role) {
        return;
      }

      await updateUserRole({
        role,
      });
      form.reset(value);
    },
  });

  return (
    <form
      id="user-settings-role-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FormBlock
        description={t("role-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isDirty, state.isSubmitting]}
          >
            {([isDirty, isSubmitting]) => (
              <div className="flex w-full items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">
                  {t("role-footer")}
                </p>
                <Button
                  disabled={!isDirty || isSubmitting}
                  size="sm"
                  type="submit"
                >
                  {t("save")}
                </Button>
              </div>
            )}
          </form.Subscribe>
        }
        title={t("role")}
      >
        <form.Field name="role">
          {(field) => (
            <Field>
              <FieldLabel className="sr-only" htmlFor="user-settings-role">
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
                  className="w-full max-w-xs"
                  id="user-settings-role"
                >
                  <SelectValue placeholder={t("role-placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <role.icon />
                      {t(role.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
      </FormBlock>
    </form>
  );
}
