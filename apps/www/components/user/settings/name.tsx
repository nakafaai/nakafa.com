"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Schema } from "effect";
import { useTranslations } from "next-intl";
import { FormBlock } from "@/components/shared/form-block";
import type { CurrentUser } from "@/lib/context/use-user";

const MAX_NAME_LENGTH = 32;
const MIN_NAME_LENGTH = 3;

const formSchema = Schema.standardSchemaV1(
  Schema.Struct({
    name: Schema.Trim.pipe(
      Schema.minLength(MIN_NAME_LENGTH),
      Schema.maxLength(MAX_NAME_LENGTH)
    ),
  })
);

export function UserSettingsName({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");

  const updateUserName = useMutation(api.users.mutations.updateUserName);

  const form = useForm({
    defaultValues: {
      name: user.authUser.name,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      await updateUserName({
        name: value.name,
      });
      form.reset();
    },
  });

  return (
    <form action={() => form.handleSubmit()} id="user-settings-name-form">
      <FormBlock
        description={t("name-description")}
        footer={
          <form.Subscribe
            selector={(state) => [
              state.isDirty,
              state.isValid,
              state.isSubmitting,
            ]}
          >
            {([isDirty, isValid, isSubmitting]) => {
              const canSubmit = Boolean(isDirty) && Boolean(isValid);
              const isDisabled = !canSubmit || Boolean(isSubmitting);
              return (
                <div className="flex w-full items-center justify-between gap-4">
                  <p className="text-muted-foreground text-sm">
                    {t("name-footer")}
                  </p>
                  <Button disabled={isDisabled} size="sm" type="submit">
                    {t("save")}
                  </Button>
                </div>
              );
            }}
          </form.Subscribe>
        }
        title={t("name")}
      >
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              Boolean(field.state.meta.isTouched) &&
              Boolean(!field.state.meta.isValid);
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel className="sr-only" htmlFor="user-settings-name">
                  {t("name")}
                </FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  className="max-w-xs"
                  id="user-settings-name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("name-placeholder")}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>
      </FormBlock>
    </form>
  );
}
