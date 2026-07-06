"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useTryoutClock } from "@/components/tryout/clock";
import { isTryoutActive } from "@/components/tryout/status";

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

interface StartTryoutButtonProps {
  attempt?: CurrentAttempt;
  countryKey: string;
  examKey: string;
  firstSectionHref: string;
  locale: Locale;
  setKey: string;
}

/** Starts a Convex-owned try-out attempt and opens the first section on success. */
export function StartTryoutButton({
  attempt,
  countryKey,
  examKey,
  firstSectionHref,
  locale,
  setKey,
}: StartTryoutButtonProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const startAttempt = useMutation(api.tryouts.mutations.attempts.startAttempt);
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const authRedirectHref = `/${locale}${firstSectionHref}`;
  const now = useTryoutClock(attempt?.status === "in-progress");
  const hasActiveAttempt = Boolean(
    attempt &&
      isTryoutActive({
        expiresAt: attempt.expiresAt,
        now,
        status: attempt.status,
      })
  );
  const hasFinishedAttempt = Boolean(attempt && !hasActiveAttempt);
  const isAttemptLoading = isAuthenticated && attempt === undefined;
  const isBusy = isLoading || isPending || isAttemptLoading;
  let buttonLabel = tTryouts("start-cta");
  let dialogDescription = tTryouts("start-dialog-description");
  let dialogTitle = tTryouts("start-dialog-title");
  let confirmLabel = tTryouts("start-cta");

  if (hasFinishedAttempt) {
    buttonLabel = tTryouts("restart-cta");
    confirmLabel = tTryouts("restart-cta");
    dialogDescription = tTryouts("restart-dialog-description");
    dialogTitle = tTryouts("restart-dialog-title");
  }

  if (hasActiveAttempt) {
    buttonLabel = tTryouts("continue-cta");
  }

  function onStart() {
    if (isBusy) {
      return;
    }

    if (!isAuthenticated) {
      router.push(`/auth?redirect=${encodeURIComponent(authRedirectHref)}`);
      return;
    }

    if (hasActiveAttempt) {
      router.push(firstSectionHref);
      return;
    }

    openDialog();
  }

  function onConfirm() {
    if (isBusy) {
      return;
    }

    if (!isAuthenticated) {
      closeDialog();
      router.push(`/auth?redirect=${encodeURIComponent(authRedirectHref)}`);
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            startAttempt({
              countryKey,
              examKey,
              locale,
              setKey,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              closeDialog();
              router.push(firstSectionHref);
              toast.success(tTryouts("start-success"), {
                position: "bottom-center",
              });
            })
          ),
          Effect.catchAll(() =>
            Effect.sync(() => {
              toast.error(tTryouts("start-error"), {
                position: "bottom-center",
              });
            })
          )
        )
      );
    });
  }

  return (
    <>
      <Button disabled={isBusy} onClick={onStart}>
        <Spinner className="size-4" icon={Rocket01Icon} isLoading={isPending} />
        {buttonLabel}
      </Button>

      <ResponsiveDialog
        description={dialogDescription}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isPending}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              {tTryouts("cancel-cta")}
            </Button>
            <Button disabled={isBusy} onClick={onConfirm} type="button">
              <Spinner
                className="size-4"
                icon={Rocket01Icon}
                isLoading={isPending}
              />
              {confirmLabel}
            </Button>
          </div>
        }
        open={isDialogOpen}
        setOpen={(open) => {
          if (open) {
            openDialog();
            return;
          }

          closeDialog();
        }}
        title={dialogTitle}
      />
    </>
  );
}

interface StartSectionButtonProps {
  attemptId: Id<"tryoutAttempts">;
  sectionKey: string;
}

/** Starts the selected section inside an already-active try-out attempt. */
export function StartSectionButton({
  attemptId,
  sectionKey,
}: StartSectionButtonProps) {
  const startSection = useMutation(api.tryouts.mutations.sections.start);
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();

  /** Starts this section timer and lets the Convex runtime subscription update. */
  function onStart() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            startSection({
              attemptId,
              sectionKey,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              toast.success(tTryouts("start-part-success"), {
                position: "bottom-center",
              });
            })
          ),
          Effect.catchAll(() =>
            Effect.sync(() => {
              toast.error(tTryouts("start-part-error"), {
                position: "bottom-center",
              });
            })
          )
        )
      );
    });
  }

  return (
    <Button disabled={isPending} onClick={onStart} type="button">
      <Spinner className="size-4" icon={Rocket01Icon} isLoading={isPending} />
      {tTryouts("start-part-cta")}
    </Button>
  );
}
