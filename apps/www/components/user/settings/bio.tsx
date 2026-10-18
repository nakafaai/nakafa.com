"use client";

import { readBio, tidyBio } from "@repo/backend/confect/users/bio";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CardSection,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { useUpdateBioMutation } from "@/components/user/mutation.client";
import { SettingsSave } from "@/components/user/settings/save";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/**
 * Renders the bio card: a few lines about the account. A bio that is too long
 * says so in words, and Save waits until it fits.
 */
export function UserSettingsBio({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const updateBio = useUpdateBioMutation();
  const current = user.appUser.bio ?? "";
  const [typed, setTyped] = useState(current);
  const text = tidyBio(typed);
  const fits = Result.isSuccess(readBio(typed));
  const canSave = fits && text !== current;

  const save = (bio: string) =>
    Effect.runPromise(
      Effect.tryPromise(() => updateBio({ bio })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/settings/bio",
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

  return (
    <form
      id="user-settings-bio-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          save(text);
        }
      }}
    >
      <CardSection>
        <CardHeader>
          <CardTitle>{t("bio")}</CardTitle>
          <CardDescription>{t("bio-description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={!fits}>
            <FieldLabel className="sr-only" htmlFor="user-settings-bio">
              {t("bio")}
            </FieldLabel>
            <Textarea
              aria-invalid={!fits}
              className="max-w-md"
              id="user-settings-bio"
              name="bio"
              onChange={(event) => setTyped(event.target.value)}
              placeholder={t("bio-placeholder")}
              value={typed}
            />
          </Field>
        </CardContent>
        <CardSectionFooter>
          {/* Only the too-long message is an alert, so only it is announced as it appears. */}
          {fits ? (
            <CardSectionHint>{t("bio-footer")}</CardSectionHint>
          ) : (
            <CardSectionHint role="alert" tone="destructive">
              {t("bio-too-long")}
            </CardSectionHint>
          )}
          <SettingsSave disabled={!canSave} />
        </CardSectionFooter>
      </CardSection>
    </form>
  );
}
