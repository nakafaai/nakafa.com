"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { selfSelectableUserRoles } from "@repo/backend/convex/users/roles";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { FormBlock } from "@/components/shared/form-block";
import type { CurrentUser } from "@/lib/context/use-user";
import { roles } from "@/lib/data/roles";

const roleSchema = Schema.Literal(...selfSelectableUserRoles);
const formSchema = Schema.standardSchemaV1(
  Schema.Struct({
    role: roleSchema,
  })
);

/** Renders the settings form that validates and saves the user's app role. */
export function UserSettingsRole({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const roleItems = roles.map((role) => ({
    label: (
      <>
        <HugeIcons icon={role.icon} />
        {t(role.value)}
      </>
    ),
    value: role.value,
  }));

  const updateUserRole = useMutation(api.users.mutations.updateUserRole);
  const initialRole = roles.find(
    (role) => role.value === user.appUser.role
  )?.value;

  const form = useForm({
    defaultValues: {
      role: initialRole,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      const role = Schema.decodeUnknownOption(roleSchema)(value.role);
      if (Option.isNone(role)) {
        return;
      }

      await updateUserRole({
        role: role.value,
      });
      form.reset(value);
    },
  });

  return (
    <form action={() => form.handleSubmit()} id="user-settings-role-form">
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
                items={roleItems}
                name={field.name}
                onValueChange={(value) => {
                  const parsed = Schema.decodeUnknownOption(roleSchema)(value);
                  if (Option.isSome(parsed)) {
                    field.handleChange(parsed.value);
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
                  <SelectGroup>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <HugeIcons icon={role.icon} />
                        {t(role.value)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
      </FormBlock>
    </form>
  );
}
