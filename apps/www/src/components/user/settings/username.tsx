import { QueryResult, useQuery } from "@confect/react";
import { useDebouncedValue } from "@mantine/hooks";
import users from "@repo/backend/confect/_generated/refs/users";
import {
  readUsername,
  USERNAME_MAX_LENGTH,
} from "@repo/backend/confect/users/username";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Field,
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
import { MAIN_DOMAIN } from "@repo/site/domains";
import { Effect, Option, Result } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useUpdateUsernameMutation } from "@/components/user/mutation";
import { SettingsSave } from "@/components/user/settings/save";
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
  const t = useTranslations("Auth");
  const updateUsername = useUpdateUsernameMutation();
  const current = user.appUser.username;
  const [typed, setTyped] = useState(current ?? "");
  const [asked] = useDebouncedValue(typed, CHECK_DELAY_MILLISECONDS);
  // The check needs the session, which Convex learns a moment after the page draws.
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const check = useQuery(
    users.queries.checkUsername,
    isAuthenticated ? { username: asked } : "skip"
  );
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
  // The line keeps the last answer while the next name is checked, so it never blanks between keys; the
  // account's own name has nothing to answer, and clears it.
  const [lastAnswer, setLastAnswer] = useState(reply.message);
  if (reply.message !== undefined && reply.message !== lastAnswer) {
    setLastAnswer(reply.message);
  }
  const answer =
    stored !== undefined && stored === current
      ? undefined
      : (reply.message ?? lastAnswer);

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
                placeholder={t("username-placeholder")}
                spellCheck={false}
                value={typed}
              />
            </InputGroup>
            {/* One line always answers the typed name, so the card never grows while the name is checked:
                a free name reads muted, a refused one in the error colour. */}
            <FieldError
              className={
                answer === "username-available"
                  ? "text-muted-foreground"
                  : undefined
              }
            >
              {answer === undefined ? null : t(answer)}
            </FieldError>
          </Field>
        </CardContent>
        <CardSectionFooter hint={t("username-footer")}>
          <SettingsSave disabled={!reply.canSave} />
        </CardSectionFooter>
      </CardSection>
    </form>
  );
}
