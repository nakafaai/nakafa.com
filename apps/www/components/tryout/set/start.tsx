"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

export interface StartTryoutRequest {
  authRedirectHref: string;
  countryKey: string;
  entrySectionKey?: string;
  examKey: string;
  firstSectionHref: string;
  firstSectionKey: string;
  locale: Locale;
  setKey: string;
  trackKey: string;
}

interface StartTryoutButtonProps {
  attempt?: CurrentAttempt;
  request: StartTryoutRequest;
}

/** Starts or resumes a Convex-owned try-out attempt from the current page. */
export function StartTryoutButton({
  attempt,
  request,
}: StartTryoutButtonProps) {
  const router = useRouter();
  const prewarmData = useTryoutDataIntent();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const startAttempt = useMutation(api.tryouts.mutations.attempts.startAttempt);
  const startSection = useMutation(api.tryouts.mutations.sections.start);
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const authRedirectHref = `/${request.locale}${request.authRedirectHref}`;
  const hasActiveAttempt = attempt?.status === "in-progress";
  const hasFinishedAttempt = Boolean(attempt && !hasActiveAttempt);
  const isAttemptLoading = isAuthenticated && attempt === undefined;
  const isBusy = isLoading || isPending || isAttemptLoading;
  const isDirectEntry = Boolean(request.entrySectionKey);
  let buttonLabel = tTryouts("start-cta");
  let dialogDescription = isDirectEntry
    ? tTryouts("start-entry-dialog-description")
    : tTryouts("start-dialog-description");
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

    if (hasActiveAttempt && request.entrySectionKey) {
      const entrySectionKey = request.entrySectionKey;

      startTransition(async () => {
        await Effect.runPromise(
          startEntrySection({
            attemptId: attempt.attemptId,
            sectionKey: entrySectionKey,
            startSection,
            successMessage: tTryouts("start-entry-success"),
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
              countryKey: request.countryKey,
              ...(request.entrySectionKey
                ? { entrySectionKey: request.entrySectionKey }
                : {}),
              examKey: request.examKey,
              locale: request.locale,
              setKey: request.setKey,
              trackKey: request.trackKey,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              closeDialog();
              const successMessage = isDirectEntry
                ? tTryouts("start-entry-success")
                : tTryouts("start-success");

              toast.success(successMessage, { position: "bottom-center" });
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

  if (hasActiveAttempt && !isDirectEntry) {
    return (
      <TryoutIntentLink
        className={buttonVariants()}
        href={request.firstSectionHref}
        onIntent={() =>
          prewarmData({
            countryKey: request.countryKey,
            examKey: request.examKey,
            kind: "section",
            locale: request.locale,
            sectionKey: request.firstSectionKey,
            setKey: request.setKey,
            trackKey: request.trackKey,
          })
        }
      >
        <Spinner icon={Rocket01Icon} isLoading={false} />
        {buttonLabel}
      </TryoutIntentLink>
    );
  }

  return (
    <>
      <Button disabled={isBusy} onClick={onStart}>
        <Spinner
          data-icon="inline-start"
          icon={Rocket01Icon}
          isLoading={isPending}
        />
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
                data-icon="inline-start"
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
  sectionKey,
  startSection,
  successMessage,
  tTryouts,
}: {
  attemptId: Id<"tryoutAttempts">;
  sectionKey: string;
  startSection: (args: {
    attemptId: Id<"tryoutAttempts">;
    sectionKey: string;
  }) => Promise<unknown>;
  successMessage: string;
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
        toast.success(successMessage, { position: "bottom-center" });
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
