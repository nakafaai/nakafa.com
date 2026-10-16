"use client";

import {
  BIO_MAX_LENGTH,
  readBio,
  tidyBio,
} from "@repo/backend/confect/users/bio";
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
import { cn } from "cn";
import { Array as Arr, Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useUpdateBioMutation } from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/** Renders the bio card: one line about the account, with its count of characters. */
export function UserSettingsBio({ user }: { user: CurrentUser }) {
  const tToast = useTranslations("Toast");
  const t = useTranslations("Auth");
  const updateBio = useUpdateBioMutation();
  const current = user.appUser.bio ?? "";
  const [typed, setTyped] = useState(current);
  const text = tidyBio(typed);
  const count = Arr.fromIterable(text).length;
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
                  toast.error(tToast("action-error.title"), {
                    description: tToast("action-error.description"),
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
            <Input
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
          <div className="flex w-full items-center justify-between gap-4">
            <p
              className={cn(
                "text-sm",
                fits ? "text-muted-foreground" : "text-destructive"
              )}
            >
              {t("bio-count", { count, max: BIO_MAX_LENGTH })}
            </p>
            <Button disabled={!canSave} size="sm" type="submit">
              {t("save")}
            </Button>
          </div>
        </CardSectionFooter>
      </CardSection>
    </form>
  );
}
