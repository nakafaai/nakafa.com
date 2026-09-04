"use client";
import {
  Alert02Icon,
  Delete02Icon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvex, useMutation } from "convex/react";
import { Effect, Result } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormBlock } from "@/components/shared/form-block";
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
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";

const dialogError = {
  generic: "generic",
  schoolMemberRequired: "school-member-required",
  sessionExpired: "session-expired",
} as const;
type DialogError = (typeof dialogError)[keyof typeof dialogError] | null;
/** Renders the destructive account-deletion card and confirmation flow. */
export function UserSettingsDeleteAccount({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const convex = useConvex();
  const cancelAccountDeletion = useMutation(
    api.auth.deletion.cancelAccountDeletionAttempt
  );
  const prepareAccountDeletion = useMutation(
    api.auth.deletion.prepareCurrentAccountDeletion
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DialogError>(null);
  const [isPending, startTransition] = useTransition();
  /** Keeps the confirmation dialog open while deletion work is in flight. */
  function handleOpenChange(nextOpen: boolean) {
    if (isPending && !nextOpen) {
      return;
    }
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
    }
  }
  /** Runs the durable account-deletion flow from the browser event boundary. */
  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await Effect.runPromise(
        loadOrCreateAccountDeletionAttempt(userId).pipe(
          Effect.flatMap((attempt) =>
            deleteCurrentAccount({
              attempt,
              cancelPreparation: (attemptId) =>
                cancelAccountDeletion({ attemptId }),
              clearAttempt: clearAccountDeletionAttempt(),
              persist: saveAccountDeletionAttempt,
              prepare: (attemptId) => prepareAccountDeletion({ attemptId }),
              reconcile: (attemptId) =>
                convex.query(
                  api.auth.deletion.getAccountDeletionAttemptStatus,
                  { attemptId }
                ),
            })
          ),
          Effect.andThen(clearDeletedAccountBrowserIdentity()),
          Effect.result
        )
      );
      if (Result.isSuccess(result)) {
        window.location.replace(`/${locale}`);
        return;
      }

      let nextError: Exclude<DialogError, null> = dialogError.generic;
      if (result.failure._tag === "AccountDeletionSessionExpired") {
        nextError = dialogError.sessionExpired;
      } else if (
        result.failure._tag === "AccountDeletionSchoolMemberRequired"
      ) {
        nextError = dialogError.schoolMemberRequired;
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
        router.replace(authNavigation.readHref());
        return;
      }
      startTransition(() => setError(dialogError.generic));
    });
  }
  let errorMessage = t("delete-account-error");
  if (error === dialogError.sessionExpired) {
    errorMessage = t("delete-account-session-expired");
  } else if (error === dialogError.schoolMemberRequired) {
    errorMessage = t("delete-account-school-member-required");
  }
  return (
    <>
      <FormBlock
        description={t("delete-account-description")}
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              {t("delete-account-footer")}
            </p>
            <Button
              onClick={() => setOpen(true)}
              type="button"
              variant="destructive"
            >
              <HugeIcons icon={Delete02Icon} />
              {t("delete-account")}
            </Button>
          </div>
        }
        title={t("delete-account")}
        variant="destructive"
      />

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
        open={open}
        setOpen={handleOpenChange}
        title={t("delete-account-dialog-title")}
      >
        {error && (
          <Alert variant="destructive">
            <HugeIcons icon={Alert02Icon} />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </ResponsiveDialog>
    </>
  );
}
