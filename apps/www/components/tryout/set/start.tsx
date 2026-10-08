"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import refs from "@repo/backend/confect/_generated/refs";
import { Button } from "@repo/design-system/components/ui/button";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useConvexAuth } from "@/components/providers/convex";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutStartDialog } from "@/components/tryout/set/dialog";
import type { CurrentAttempt } from "@/components/tryout/set/model";
import {
  startAttemptProgram,
  startEntrySectionProgram,
} from "@/components/tryout/set/program";

type StartAttempt = Pick<
  CurrentAttempt,
  "attemptId" | "resumeSectionKey" | "status"
> | null;
export interface StartTryoutRequest {
  authRedirectHref: string;
  countryKey: string;
  destinationHref: string;
  destinationSectionKey: string;
  entrySectionKey?: string;
  examKey: string;
  locale: PublicAppLocale;
  setKey: string;
  successNavigation: "destination" | "stay";
  trackKey: string;
}
interface StartTryoutButtonProps {
  attempt?: StartAttempt | undefined;
  request: StartTryoutRequest;
}

/** Composes the active attempt link or the transactional start action. */
export function StartTryoutButton(props: StartTryoutButtonProps) {
  if (
    props.attempt?.status === "in-progress" &&
    !props.request.entrySectionKey
  ) {
    return <ResumeTryoutLink request={props.request} />;
  }
  return <TryoutStartAction {...props} />;
}

/** Starts or resumes a free try-out from the current page. */
function TryoutStartAction({ attempt, request }: StartTryoutButtonProps) {
  const router = useRouter();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const startAttempt = useMutation(
    refs.public.tryouts.mutations.attempts.startAttempt
  );
  const startSection = useMutation(
    refs.public.tryouts.mutations.sections.start
  );
  const t = useTranslations("Tryouts");
  const now = useTryoutClock(false);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, dialog] = useDisclosure(false);
  const activeAttempt = attempt?.status === "in-progress";
  const finishedAttempt = Boolean(attempt && !activeAttempt);
  const directEntry = Boolean(request.entrySectionKey);
  const access = useQuery(
    refs.public.tryouts.queries.access.getStartAccess,
    isAuthenticated && !activeAttempt
      ? {
          countryKey: request.countryKey,
          examKey: request.examKey,
          locale: request.locale,
          now,
          setKey: request.setKey,
          trackKey: request.trackKey,
        }
      : "skip"
  );
  if (QueryResult.isFailure(access)) {
    throw access.error;
  }
  const accessLoading =
    isAuthenticated && !activeAttempt && !QueryResult.isSuccess(access);
  const attemptLoading = isAuthenticated && attempt === undefined;
  const resolvingAccess = isLoading || accessLoading || attemptLoading;
  const busy = isPending || resolvingAccess;
  const dialogKind = QueryResult.isSuccess(access)
    ? access.value.kind
    : "free-attempt";
  const buttonLabel = activeAttempt
    ? t("continue-cta")
    : t(finishedAttempt ? "restart-cta" : "start-cta");
  const authRedirect = `/${request.locale}${request.authRedirectHref}`;

  /** Opens the correct decision or continues an already-active runtime. */
  function onStart() {
    if (busy) {
      return;
    }
    if (!isAuthenticated) {
      router.push(`/auth?redirect=${encodeURIComponent(authRedirect)}`);
      return;
    }
    if (attempt?.status === "in-progress" && request.entrySectionKey) {
      const sectionKey = attempt.resumeSectionKey ?? request.entrySectionKey;
      startTransition(() =>
        Effect.runPromise(
          startEntrySectionProgram({
            attemptId: attempt.attemptId,
            failureMessage: t("start-part-error"),
            mutation: startSection,
            sectionKey,
            successMessage: t("start-entry-success"),
          })
        )
      );
      return;
    }
    dialog.open();
  }

  /** Starts the attempt transactionally after confirmation. */
  function onPrimary() {
    if (busy) {
      return;
    }
    const program = startAttemptProgram({
      args: {
        countryKey: request.countryKey,
        ...(directEntry
          ? {}
          : {
              destinationSectionKey: request.destinationSectionKey,
            }),
        ...(request.entrySectionKey === undefined
          ? {}
          : {
              entrySectionKey: request.entrySectionKey,
            }),
        examKey: request.examKey,
        locale: request.locale,
        setKey: request.setKey,
        trackKey: request.trackKey,
      },
      failureMessage: t("start-error"),
      mutation: startAttempt,
      onSuccess: (result) =>
        Effect.sync(() => {
          dialog.close();
          toast.success(
            directEntry ? t("start-entry-success") : t("start-success"),
            {
              position: "bottom-center",
            }
          );
          const href = getTryoutAttemptHref(
            result.navigation.publicPath,
            result.attemptId
          );
          if (request.successNavigation === "stay") {
            router.replace(href);
            return;
          }
          router.push(href);
        }),
    });
    startTransition(() => Effect.runPromise(program));
  }
  return (
    <>
      <Button disabled={busy} onClick={onStart}>
        <Spinner icon={Rocket01Icon} isLoading={isPending || resolvingAccess} />
        {buttonLabel}
      </Button>
      <TryoutStartDialog
        busy={isPending}
        directEntry={directEntry}
        finishedAttempt={finishedAttempt}
        kind={dialogKind}
        onCancel={dialog.close}
        onPrimary={onPrimary}
        open={dialogOpen}
        setOpen={(open) => {
          if (open) {
            onStart();
            return;
          }
          dialog.close();
        }}
      />
    </>
  );
}

/**
 * Holds the action's place at its final height while the attempt that decides
 * it is still on its way. It names no action, because only that attempt tells
 * starting, continuing, and restarting apart.
 */
export function PendingTryoutAction() {
  const t = useTranslations("Tryouts");
  return (
    <Button aria-label={t("action-loading")} disabled>
      <Spinner icon={Rocket01Icon} isLoading />
    </Button>
  );
}

/** Links to the next section of the active attempt. */
function ResumeTryoutLink({
  request,
}: {
  readonly request: StartTryoutRequest;
}) {
  const t = useTranslations("Tryouts");
  return (
    <IntentLink className={buttonVariants()} href={request.destinationHref}>
      <Spinner icon={Rocket01Icon} isLoading={false} />
      {t("continue-cta")}
    </IntentLink>
  );
}
