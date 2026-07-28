"use client";

import {
  Alert02Icon,
  Delete02Icon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { Effect, Either } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { FormBlock } from "@/components/shared/form-block";
import {
  type AccountDeletionRequestPhase,
  accountDeletionRequestPhase,
  clearDeletedAccountBrowserIdentity,
  deleteCurrentAccount,
  prepareAccountReauthentication,
} from "@/lib/auth/account-deletion";

const dialogError = {
  generic: "generic",
  schoolMemberRequired: "school-member-required",
  sessionExpired: "session-expired",
} as const;

type DialogError = (typeof dialogError)[keyof typeof dialogError] | null;

/** Renders the destructive account-deletion card and confirmation flow. */
export function UserSettingsDeleteAccount() {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const cancelAccountDeletion = useMutation(
    api.auth.deletion.cancelCurrentAccountDeletion
  );
  const prepareAccountDeletion = useMutation(
    api.auth.deletion.prepareCurrentAccountDeletion
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DialogError>(null);
  const [isPending, setIsPending] = useState(false);
  const retryAttempt = useRef<{
    readonly attemptId: string;
    readonly phase: AccountDeletionRequestPhase;
  } | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (isPending && !nextOpen) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setError(null);
    }
  }

  async function handleDelete() {
    setError(null);
    setIsPending(true);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const retry = retryAttempt.current;
        const deletion = yield* Effect.either(
          deleteCurrentAccount({
            attemptId: retry?.attemptId ?? crypto.randomUUID(),
            cancelPreparation: (attemptId) =>
              cancelAccountDeletion({ attemptId }),
            prepare: (attemptId) => prepareAccountDeletion({ attemptId }),
            startPhase: retry?.phase ?? accountDeletionRequestPhase.preparation,
          })
        );

        if (Either.isRight(deletion)) {
          yield* clearDeletedAccountBrowserIdentity();
        }

        return deletion;
      }).pipe(Effect.ensuring(Effect.sync(() => setIsPending(false))))
    );

    if (Either.isRight(result)) {
      window.location.replace(`/${locale}`);
      return;
    }

    if (result.left._tag === "AccountDeletionRequestUncertain") {
      retryAttempt.current = {
        attemptId: result.left.attemptId,
        phase: result.left.phase,
      };
    } else {
      retryAttempt.current = null;
    }

    if (result.left._tag === "AccountDeletionSessionExpired") {
      setError(dialogError.sessionExpired);
      return;
    }

    setError(
      result.left._tag === "AccountDeletionSchoolMemberRequired"
        ? dialogError.schoolMemberRequired
        : dialogError.generic
    );
  }

  async function handleReauthenticate() {
    setError(null);
    setIsPending(true);

    const result = await Effect.runPromise(
      Effect.either(prepareAccountReauthentication()).pipe(
        Effect.ensuring(Effect.sync(() => setIsPending(false)))
      )
    );

    if (Either.isRight(result)) {
      router.replace(`/auth?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    setError(dialogError.generic);
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
