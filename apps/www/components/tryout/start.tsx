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

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

interface StartTryoutButtonProps {
  attempt?: CurrentAttempt;
  countryKey: string;
  entrySectionKey?: string;
  examKey: string;
  firstSectionHref: string;
  locale: Locale;
  setKey: string;
  trackKey: string;
}

/** Starts a Convex-owned try-out attempt and opens the first section on success. */
export function StartTryoutButton({
  attempt,
  countryKey,
  entrySectionKey,
  examKey,
  firstSectionHref,
  locale,
  setKey,
  trackKey,
}: StartTryoutButtonProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const startAttempt = useMutation(api.tryouts.mutations.attempts.startAttempt);
  const startSection = useMutation(api.tryouts.mutations.sections.start);
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const authRedirectHref = `/${locale}${firstSectionHref}`;
  const hasActiveAttempt = attempt?.status === "in-progress";
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
      if (!entrySectionKey) {
        router.push(firstSectionHref);
        return;
      }

      startTransition(async () => {
        await Effect.runPromise(
          startEntrySection({
            attemptId: attempt.attemptId,
            firstSectionHref,
            router,
            sectionKey: entrySectionKey,
            startSection,
            tTryouts,
          })
        );
      });
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
              trackKey,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.flatMap((result) =>
            entrySectionKey
              ? Effect.tryPromise({
                  try: () =>
                    startSection({
                      attemptId: result.attemptId,
                      sectionKey: entrySectionKey,
                    }),
                  catch: (cause) => cause,
                })
              : Effect.succeed(undefined)
          ),
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

/** Starts the internal entry section for an already-active attempt. */
function startEntrySection({
  attemptId,
  firstSectionHref,
  router,
  sectionKey,
  startSection,
  tTryouts,
}: {
  attemptId: Id<"tryoutAttempts">;
  firstSectionHref: string;
  router: ReturnType<typeof useRouter>;
  sectionKey: string;
  startSection: (args: {
    attemptId: Id<"tryoutAttempts">;
    sectionKey: string;
  }) => Promise<unknown>;
  tTryouts: ReturnType<typeof useTranslations>;
}) {
  return Effect.tryPromise({
    try: () =>
      startSection({
        attemptId,
        sectionKey,
      }),
    catch: (cause) => cause,
  }).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        router.push(firstSectionHref);
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
  );
}
