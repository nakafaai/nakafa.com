import { HttpClient } from "@confect/js";
import { useMutation } from "@confect/react";
import { Delete02Icon, Login01Icon } from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
import {
  clearAccountDeletionAttempt,
  loadOrCreateAccountDeletionAttempt,
  saveAccountDeletionAttempt,
} from "@/lib/auth/deletion/attempt";
import { deleteCurrentAccount } from "@/lib/auth/deletion/delete";
import {
  clearDeletedAccountBrowserIdentity,
  signOutAccountBrowserIdentity,
} from "@/lib/auth/identity/browser";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { httpLayer } from "@/lib/convex/http";
import { requireConvexOnline } from "@/lib/convex/online";
import { useCurrentLocale } from "@/lib/routing/link";

const dialogError = {
  generic: "generic",
  sessionExpired: "session-expired",
} as const;
type DialogError = (typeof dialogError)[keyof typeof dialogError] | null;
/** Renders the destructive account-deletion card and confirmation flow. */
export function UserSettingsDeleteAccount({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const locale = useCurrentLocale();
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const cancelAccountDeletion = useMutation(
    auth.deletion.cancelAccountDeletionAttempt
  );
  const prepareAccountDeletion = useMutation(
    auth.deletion.prepareCurrentAccountDeletion
  );
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DialogError>(null);
  const [isPending, startTransition] = useTransition();
  /** Keeps the confirmation dialog open while deletion work is in flight. */
  function handleOpenChange(nextOpen: boolean) {
    if (isPending && !nextOpen) {
      return;
    }
    setOpen(nextOpen);
  }
  /** Runs the durable account-deletion flow from the browser event boundary. */
  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.andThen(loadOrCreateAccountDeletionAttempt(userId)),
          Effect.flatMap((attempt) =>
            deleteCurrentAccount({
              attempt,
              cancelPreparation: (attemptId) =>
                cancelAccountDeletion({ attemptId }),
              clearAttempt: clearAccountDeletionAttempt(),
              persist: saveAccountDeletionAttempt,
              prepare: (attemptId) => prepareAccountDeletion({ attemptId }),
              reconcile: (attemptId) =>
                Effect.flatMap(HttpClient.HttpClient, (client) =>
                  client.query(auth.deletion.getAccountDeletionAttemptStatus, {
                    attemptId,
                  })
                ).pipe(Effect.provide(httpLayer())),
            })
          ),
          Effect.andThen(clearDeletedAccountBrowserIdentity()),
          Effect.result
        )
      );
      if (Result.isSuccess(result)) {
        window.location.replace(localizeInternalHref("/", locale));
        return;
      }

      let nextError: Exclude<DialogError, null> = dialogError.generic;
      if (result.failure._tag === "AccountDeletionSessionExpired") {
        nextError = dialogError.sessionExpired;
      }
      startTransition(() => setError(nextError));
    });
  }
  /** Signs out an expired session before returning to the localized auth page. */
  function handleReauthenticate() {
    setError(null);
    startTransition(async () => {
      const result = await Effect.runPromise(
        Effect.result(signOutAccountBrowserIdentity())
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
      <CardSection variant="destructive">
        <CardHeader>
          <CardTitle>{t("delete-account")}</CardTitle>
          <CardDescription>{t("delete-account-description")}</CardDescription>
        </CardHeader>
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
        description={t("delete-account-dialog-description")}
        footer={
          <>
            <Button
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            {error === dialogError.sessionExpired ? (
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
            )}
          </>
        }
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
        <FieldError>{error ? errorMessage : null}</FieldError>
      </ResponsiveDialog>
    </>
  );
}
