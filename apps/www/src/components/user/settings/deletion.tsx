import { useMutation } from "@confect/react";
import { Delete02Icon, Login01Icon } from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Button } from "@repo/design-system/components/ui/button";
import { FieldError } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { useRouter } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Result } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { reportClientException } from "@/lib/analytics/client";
import { signOutSession } from "@/lib/auth/client";
import { clearDeletedAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { requireConvexOnline } from "@/lib/convex/online";
import { useCurrentLocale } from "@/lib/routing/link";

const dialogError = {
  generic: "generic",
  sessionExpired: "session-expired",
} as const;
type DialogError = (typeof dialogError)[keyof typeof dialogError] | null;

/** Renders the destructive account-deletion card and its one confirmation. */
export function UserSettingsDeleteAccount() {
  const t = useTranslations("Auth");
  const locale = useCurrentLocale();
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const deleteAccount = useMutation(auth.deletion.deleteAccount);
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DialogError>(null);
  const [isPending, startTransition] = useTransition();
  /** Keeps the confirmation dialog open while the deletion is in flight. */
  function handleOpenChange(nextOpen: boolean) {
    if (isPending && !nextOpen) {
      return;
    }
    setOpen(nextOpen);
  }
  /**
   * Deletes the account in one mutation, then ends the page's session and
   * clears the browser's account state on the way home. The server has already
   * ended every session of the account, so a sign-out that fails here is
   * reported and never holds the person on a page of an account that is gone.
   */
  function handleDelete() {
    // A refusal stays on its line while the deletion is tried again: the next
    // answer replaces it, and it is forgotten once the dialog has closed.
    startTransition(async () => {
      const result = await Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.andThen(Effect.tryPromise(() => deleteAccount())),
          Effect.flatMap(Effect.fromResult),
          Effect.andThen(
            signOutSession(convex).pipe(
              Effect.catchCause((cause) =>
                reportClientException(cause, { source: "account-deletion" })
              )
            )
          ),
          Effect.andThen(clearDeletedAccountBrowserIdentity()),
          Effect.result
        )
      );
      if (Result.isSuccess(result)) {
        window.location.replace(localizeInternalHref("/", locale));
        return;
      }
      const nextError =
        result.failure._tag === "SessionRequired"
          ? dialogError.sessionExpired
          : dialogError.generic;
      startTransition(() => setError(nextError));
    });
  }
  /** Ends the stale session before returning to the localized sign-in page. */
  function handleReauthenticate() {
    startTransition(async () => {
      const result = await Effect.runPromise(
        Effect.result(signOutSession(convex))
      );
      if (Result.isSuccess(result)) {
        window.location.replace(
          router.buildLocation(authNavigation.readTarget()).publicHref
        );
        return;
      }
      startTransition(() => setError(dialogError.generic));
    });
  }
  let errorMessage = t("delete-account-error");
  if (error === dialogError.sessionExpired) {
    errorMessage = t("delete-account-session-expired");
  }
  return (
    <>
      <CardSection
        description={t("delete-account-description")}
        title={t("delete-account")}
        variant="destructive"
      >
        <CardSectionFooter hint={t("delete-account-footer")}>
          <CardSectionActions>
            <Button
              onClick={() => setOpen(true)}
              type="button"
              variant="destructive"
            >
              <HugeIcons icon={Delete02Icon} />
              {t("delete-account")}
            </Button>
          </CardSectionActions>
        </CardSectionFooter>
      </CardSection>

      <ResponsiveDialog
        action={
          error === dialogError.sessionExpired ? (
            <Button
              disabled={isPending}
              onClick={handleReauthenticate}
              type="button"
            >
              <Spinner icon={Login01Icon} isLoading={isPending} />
              {t("delete-account-sign-in-again")}
            </Button>
          ) : (
            <Button
              disabled={isPending}
              onClick={handleDelete}
              type="button"
              variant="destructive"
            >
              <Spinner icon={Delete02Icon} isLoading={isPending} />
              {t("delete-account")}
            </Button>
          )
        }
        description={t("delete-account-dialog-description")}
        // The error is forgotten once the dialog has closed, so the closing dialog keeps its line.
        onOpenChangeComplete={(next) => {
          if (!next) {
            setError(null);
          }
        }}
        open={open}
        setOpen={handleOpenChange}
        title={t("delete-account-dialog-title")}
      >
        {error ? <FieldError>{errorMessage}</FieldError> : undefined}
      </ResponsiveDialog>
    </>
  );
}
