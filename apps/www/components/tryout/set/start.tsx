"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutStartDialog } from "@/components/tryout/set/start-dialog";
import {
  checkoutProgram,
  paywallViewProgram,
  startAttemptProgram,
  startEntrySectionProgram,
} from "@/components/tryout/set/start-program";
import { getTryoutStartDialogKind } from "@/lib/tryout/access";

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

export interface StartTryoutRequest {
  authRedirectHref: string;
  countryKey: string;
  destinationHref: string;
  destinationSectionKey: string;
  entrySectionKey?: string;
  examKey: string;
  locale: Locale;
  setKey: string;
  trackKey: string;
}

interface StartTryoutButtonProps {
  attempt?: CurrentAttempt;
  request: StartTryoutRequest;
}

/** Starts, resumes, or clearly upgrades one try-out from the current page. */
export function StartTryoutButton({
  attempt,
  request,
}: StartTryoutButtonProps) {
  const router = useRouter();
  const prewarmData = useTryoutDataIntent();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const startAttempt = useMutation(api.tryouts.mutations.attempts.startAttempt);
  const startSection = useMutation(api.tryouts.mutations.sections.start);
  const trackPaywall = useMutation(
    api.tryouts.mutations.access.trackPaywallView
  );
  const generateCheckout = useAction(
    api.customers.actions.public.generateCheckoutLink
  );
  const t = useTranslations("Tryouts");
  const now = useTryoutClock(false);
  const [isPending, startTransition] = useTransition();
  const [forceUpgrade, setForceUpgrade] = useState(false);
  const [dialogOpen, dialog] = useDisclosure(false);
  const activeAttempt = attempt?.status === "in-progress";
  const finishedAttempt = Boolean(attempt && !activeAttempt);
  const directEntry = Boolean(request.entrySectionKey);
  const access = useQuery(
    api.tryouts.queries.access.getStartAccess,
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
  const accessLoading = isAuthenticated && !activeAttempt && !access;
  const attemptLoading = isAuthenticated && attempt === undefined;
  const resolvingAccess = isLoading || accessLoading || attemptLoading;
  const busy = isPending || resolvingAccess;
  const dialogKind = getTryoutStartDialogKind(access, forceUpgrade);
  const buttonLabel = getButtonLabel({
    activeAttempt,
    dialogKind,
    finishedAttempt,
    resolvingAccess,
    t,
  });
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

    if (activeAttempt && request.entrySectionKey) {
      runEntrySection(request.entrySectionKey);
      return;
    }

    if (dialogKind === "upgrade-required") {
      recordPaywallView("access-query");
    }

    dialog.open();
  }

  /** Runs the dialog's authoritative start or checkout action. */
  function onPrimary() {
    if (busy) {
      return;
    }

    if (dialogKind === "upgrade-required") {
      runAttemptStart(createCheckoutProgram);
      return;
    }

    runAttemptStart(createPaywallProgram);
  }

  /** Starts authoritatively before either showing or continuing to checkout. */
  function runAttemptStart(onDenied: () => Effect.Effect<void>) {
    const program = startAttemptProgram({
      args: {
        countryKey: request.countryKey,
        ...(request.entrySectionKey
          ? { entrySectionKey: request.entrySectionKey }
          : {}),
        examKey: request.examKey,
        locale: request.locale,
        setKey: request.setKey,
        trackKey: request.trackKey,
      },
      failureMessage: t("start-error"),
      mutation: startAttempt,
      onSuccess: () =>
        Effect.sync(() => {
          dialog.close();
          toast.success(
            directEntry ? t("start-entry-success") : t("start-success"),
            { position: "bottom-center" }
          );
        }),
      onUpgrade: onDenied,
    });

    startTransition(() => Effect.runPromise(program));
  }

  /** Builds the existing Pro checkout program after authoritative denial. */
  function createCheckoutProgram() {
    return checkoutProgram({
      action: generateCheckout,
      failureMessage: t("checkout-error"),
      locale: request.locale,
    });
  }

  /** Shows the authoritative paywall before recording its detached impression. */
  function createPaywallProgram() {
    return Effect.sync(() => setForceUpgrade(true)).pipe(
      Effect.tap(() =>
        Effect.forkDaemon(
          paywallViewProgram({
            mutation: trackPaywall,
            source: "start-mutation",
          })
        )
      )
    );
  }

  /** Starts an internal entry section for an already-active attempt. */
  function runEntrySection(sectionKey: string) {
    if (!attempt) {
      return;
    }

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
  }

  /** Records a non-blocking paywall impression from its authoritative source. */
  function recordPaywallView(source: "access-query" | "start-mutation") {
    Effect.runPromise(paywallViewProgram({ mutation: trackPaywall, source }));
  }

  if (activeAttempt && !directEntry) {
    return (
      <TryoutIntentLink
        className={buttonVariants()}
        href={request.destinationHref}
        onIntent={() =>
          prewarmData({
            countryKey: request.countryKey,
            examKey: request.examKey,
            kind: "section",
            locale: request.locale,
            sectionKey: request.destinationSectionKey,
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

/** Selects the CTA that explains free, included, active, or paid access. */
function getButtonLabel({
  activeAttempt,
  dialogKind,
  finishedAttempt,
  resolvingAccess,
  t,
}: {
  activeAttempt: boolean;
  dialogKind: ReturnType<typeof getTryoutStartDialogKind>;
  finishedAttempt: boolean;
  resolvingAccess: boolean;
  t: ReturnType<typeof useTranslations<"Tryouts">>;
}) {
  if (activeAttempt) {
    return t("continue-cta");
  }
  if (resolvingAccess) {
    return t(finishedAttempt ? "restart-cta" : "start-cta");
  }
  if (dialogKind === "upgrade-required") {
    return t(finishedAttempt ? "restart-pro-cta" : "start-pro-cta");
  }
  if (dialogKind === "free-attempt") {
    return t("free-cta");
  }
  return t(finishedAttempt ? "restart-cta" : "start-cta");
}
