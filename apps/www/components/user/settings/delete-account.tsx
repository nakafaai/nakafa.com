"use client";

import {
  Alert02Icon,
  Delete02Icon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
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
import { Effect, Either } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { FormBlock } from "@/components/shared/form-block";
import {
  clearDeletedAccountBrowserIdentity,
  deleteCurrentAccount,
  prepareAccountReauthentication,
} from "@/lib/auth/account-deletion";

type DialogError = "generic" | "session-expired" | null;

/** Renders the destructive account-deletion card and confirmation flow. */
export function UserSettingsDeleteAccount() {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DialogError>(null);
  const [isPending, setIsPending] = useState(false);

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
        const deletion = yield* Effect.either(deleteCurrentAccount());

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

    setError(
      result.left._tag === "AccountDeletionSessionExpired"
        ? "session-expired"
        : "generic"
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

    setError("generic");
  }

  const errorMessage =
    error === "session-expired"
      ? t("delete-account-session-expired")
      : t("delete-account-error");

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
            {error === "session-expired" ? (
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
