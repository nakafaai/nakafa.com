"use client";

import { QueryResult, useQuery } from "@confect/react";
import { useDebouncedValue } from "@mantine/hooks";
import users from "@repo/backend/confect/_generated/refs/users";
import {
  readUsername,
  USERNAME_MAX_LENGTH,
} from "@repo/backend/confect/users/username";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@repo/design-system/components/ui/input-group";
import { toast } from "@repo/design-system/lib/toast/notify";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect, Option, Result } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useUpdateUsernameMutation } from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";
import { profileHref } from "@/lib/profile/href";
import { usernameReply } from "@/lib/profile/username";

/** How long the card waits after the last keystroke before it asks the backend. */
const CHECK_DELAY_MILLISECONDS = 300;

/**
 * Renders the username card: the address of the account, a field that is
 * checked while it is typed, and the reason in words when the name cannot be
 * taken.
 */
export function UserSettingsUsername({ user }: { user: CurrentUser }) {
  const tToast = useTranslations("Toast");
  const t = useTranslations("Auth");
  const updateUsername = useUpdateUsernameMutation();
  const current = user.appUser.username;
  const [typed, setTyped] = useState(current ?? "");
  const [asked] = useDebouncedValue(typed, CHECK_DELAY_MILLISECONDS);
  const check = useQuery(users.queries.checkUsername, { username: asked });
  if (QueryResult.isFailure(check)) {
    throw check.error;
  }
  const reply = usernameReply({
    asked,
    check: QueryResult.isSuccess(check) ? check.value : undefined,
    current,
    typed,
  });
  const stored = Option.getOrUndefined(Result.getSuccess(readUsername(typed)));
  const invalid = reply.message !== undefined && !reply.canSave;

  const save = (username: string) =>
    Effect.runPromise(
      Effect.tryPromise(() => updateUsername({ username })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/settings/username",
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
      id="user-settings-username-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (reply.canSave && stored !== undefined) {
          save(stored);
        }
      }}
    >
      <CardSection>
        <CardHeader>
          <CardTitle>{t("username")}</CardTitle>
          {current === undefined ? null : (
            <CardDescription>
              {t("username-description", {
                address: `${MAIN_DOMAIN}${profileHref(current)}`,
              })}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Field data-invalid={invalid}>
            <FieldLabel className="sr-only" htmlFor="user-settings-username">
              {t("username")}
            </FieldLabel>
            <InputGroup className="max-w-xs">
              <InputGroupAddon>
                <InputGroupText>@</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                aria-invalid={invalid}
                autoCapitalize="none"
                autoComplete="off"
                id="user-settings-username"
                maxLength={USERNAME_MAX_LENGTH}
                name="username"
                onChange={(event) => setTyped(event.target.value)}
                spellCheck={false}
                value={typed}
              />
            </InputGroup>
            {reply.message !== undefined && reply.canSave && (
              <FieldDescription>{t(reply.message)}</FieldDescription>
            )}
            {reply.message !== undefined && !reply.canSave && (
              <FieldError>{t(reply.message)}</FieldError>
            )}
          </Field>
        </CardContent>
        <CardSectionFooter>
          <div className="flex w-full items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {t("username-footer")}
            </p>
            <Button disabled={!reply.canSave} size="sm" type="submit">
              {t("save")}
            </Button>
          </div>
        </CardSectionFooter>
      </CardSection>
    </form>
  );
}
