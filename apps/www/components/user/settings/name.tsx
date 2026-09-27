"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormBlock } from "@/components/shared/form-block";
import { useUpdateUserNameMutation } from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

const MAX_NAME_LENGTH = 32;
const MIN_NAME_LENGTH = 3;
const formSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    name: Schema.Trim.pipe(
      Schema.check(Schema.isMinLength(MIN_NAME_LENGTH)),
      Schema.check(Schema.isMaxLength(MAX_NAME_LENGTH))
    ),
  })
);
/** Render the validated optimistic user-name settings form. */
export function UserSettingsName({ user }: { user: CurrentUser }) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Auth");
  const updateUserName = useUpdateUserNameMutation();
  const form = useForm({
    defaultValues: {
      name: user.authUser.name,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) =>
      Effect.runPromise(
        Effect.tryPromise(() =>
          updateUserName({
            name: value.name,
          })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.tap(() =>
            Effect.sync(() => {
              if (form.getFieldValue("name") === value.name) {
                form.reset(value);
              }
            })
          ),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/user/settings/name",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      ),
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
