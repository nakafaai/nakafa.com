"use client";

import { Button } from "@repo/design-system/components/ui/button";
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
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
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
/**
 * Render the validated user-name settings form. A save does not wait: the
 * optimistic update shows the new name at once, so Save has nothing left to
 * save, and a refused save returns the stored name, so Save offers the typed
 * name again beside the error toast.
 */
export function UserSettingsName({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const updateUserName = useUpdateUserNameMutation();
  const form = useForm({
    defaultValues: {
      name: user.authUser.name,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: ({ value }) => {
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
        <CardSectionFooter>
          <form.Subscribe
            selector={(state) => [state.values.name, state.isValid] as const}
          >
            {([name, isValid]) => (
              <>
                <CardSectionHint>{t("name-footer")}</CardSectionHint>
                <CardSectionActions>
                  <Button
                    disabled={!isValid || Str.trim(name) === user.authUser.name}
                    size="sm"
                    type="submit"
                  >
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
