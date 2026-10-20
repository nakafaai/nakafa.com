"use client";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useForm } from "@tanstack/react-form";
import { Effect, Schema, String as Str } from "effect";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import { CardSection } from "@/components/shared/card/section";
import { useUpdateUserNameMutation } from "@/components/user/mutation";
import { SettingsFormFooter } from "@/components/user/settings/save";
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
/**
 * Render the validated user-name settings form. A save does not wait: the new
 * name is the form's saved one at once and the optimistic update shows it
 * everywhere, so Save has nothing left to save. A refused save brings the
 * stored name back as the saved one and keeps the newest typed name in the
 * field, so Save offers it again beside the error toast. A refusal that a later
 * save overtook leaves the form to that save.
 */
export function UserSettingsName({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const updateUserName = useUpdateUserNameMutation();
  const latestSave = useRef(0);
  const form = useForm({
    defaultValues: {
      name: user.authUser.name,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: ({ value, formApi }) => {
      const stored = formApi.options.defaultValues?.name ?? value.name;
      const save = latestSave.current + 1;
      latestSave.current = save;
      // The new name is the saved one at once, so Save has nothing to save.
      formApi.reset(value);
      Effect.runPromise(
        Effect.tryPromise(() =>
          updateUserName({ name: Str.trim(value.name) })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/user/settings/name",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error({
                      description: "action-error.description",
                      title: "action-error.title",
                    });
                    if (save !== latestSave.current) {
                      return;
                    }
                    // The stored name comes back as the saved one, and the
                    // newest typed name stays in the field, so Save offers it.
                    const typed = formApi.getFieldMeta("name")?.isTouched
                      ? formApi.getFieldValue("name")
                      : value.name;
                    formApi.reset({ name: stored });
                    formApi.setFieldValue("name", typed);
                  })
                )
              ),
          })
        )
      );
    },
  });
  return (
    <form action={() => form.handleSubmit()} id="user-settings-name-form">
      <CardSection>
        <CardHeader>
          <CardTitle>{t("name")}</CardTitle>
          <CardDescription>{t("name-description")}</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
        <SettingsFormFooter form={form} hint={t("name-footer")} />
      </CardSection>
    </form>
  );
}
