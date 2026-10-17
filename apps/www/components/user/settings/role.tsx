"use client";

import { selfSelectableUserRoles } from "@repo/backend/confect/users/roles";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
import { toast } from "@repo/design-system/lib/toast/notify";
import { useForm } from "@tanstack/react-form";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { useUpdateUserRoleMutation } from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { roles } from "@/lib/data/roles";
import type { CurrentUser } from "@/lib/identity/client";

const roleSchema = Schema.Literals(selfSelectableUserRoles);
const formSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    role: roleSchema,
  })
);
/**
 * Renders the settings form that validates and saves the user's app role. A
 * save does not wait: the new role is the form's saved one at once and the
 * optimistic update shows it everywhere, so Save has nothing left to save. A
 * refused save brings the stored role back as the saved one and keeps the
 * chosen role, so Save offers it again beside the error toast.
 */
export function UserSettingsRole({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const roleItems = Arr.map(roles, (role) => ({
    label: (
      <>
        <HugeIcons icon={role.icon} />
        {t(role.value)}
      </>
    ),
    value: role.value,
  }));
  const updateUserRole = useUpdateUserRoleMutation();
  const initialRole = Option.getOrUndefined(
    Option.map(
      Arr.findFirst(roles, (role) => role.value === user.appUser.role),
      (role) => role.value
    )
  );
  const form = useForm({
    defaultValues: {
      role: initialRole,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: ({ value, formApi }) => {
      const stored = formApi.options.defaultValues?.role;
      // The new role is the saved one at once, so Save has nothing to save.
      formApi.reset(value);
      Effect.runPromise(
        Schema.decodeUnknownEffect(roleSchema)(value.role).pipe(
          Effect.flatMap((role) =>
            Effect.tryPromise(() => updateUserRole({ role }))
          ),
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/user/settings/role",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    // The stored role comes back as the saved one, and the
                    // chosen role stays, so Save offers it again.
                    formApi.reset({ role: stored });
                    formApi.setFieldValue("role", value.role);
                    toast.error({
                      description: "action-error.description",
                      title: "action-error.title",
                    });
                  })
                )
              ),
          })
        )
      );
    },
  });
  return (
    <form action={() => form.handleSubmit()} id="user-settings-role-form">
      <CardSection>
        <CardHeader>
          <CardTitle>{t("role")}</CardTitle>
          <CardDescription>{t("role-description")}</CardDescription>
        </CardHeader>
        <CardContent>
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
                    const parsed =
                      Schema.decodeUnknownOption(roleSchema)(value);
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
                      {Arr.map(roles, (role) => (
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
        </CardContent>
        <CardSectionFooter>
          <form.Subscribe selector={(state) => state.isDirty}>
            {(isDirty) => (
              <>
                <CardSectionHint>{t("role-footer")}</CardSectionHint>
                <CardSectionActions>
                  <Button disabled={!isDirty} size="sm" type="submit">
                    {t("save")}
                  </Button>
                </CardSectionActions>
              </>
            )}
          </form.Subscribe>
        </CardSectionFooter>
      </CardSection>
    </form>
  );
}
