"use client";

import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { useTryoutAttemptState } from "@/components/tryout/hooks/use-attempt-state";
import type { TryoutAttemptParams } from "@/components/tryout/utils/attempt-params";
import { useUser } from "@/lib/context/use-user";

export type TryoutStartButtonProps = TryoutAttemptParams;

export function useTryoutStartValue({
  locale,
  product,
  tryoutSlug,
}: TryoutStartButtonProps) {
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();
  const [isActionPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const {
    effectiveStatus,
    attemptData,
    isAttemptPending,
    resumePartKey,
    remainingTime,
  } = useTryoutAttemptState({
    locale,
    product,
    tryoutSlug,
  });
  const { data: hasSubscription, isPending: isSubscriptionPending } =
    useQueryWithStatus(
      api.subscriptions.queries.hasActiveSubscription,
      !isUserPending && user ? { productId: products.pro.id } : "skip"
    );
  const startTryout = useMutation(api.tryouts.mutations.attempts.startTryout);
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const isReady = !(
    isUserPending ||
    (user && (isAttemptPending || isSubscriptionPending))
  );
  const isLoading =
    isActionPending ||
    isUserPending ||
    (user ? isAttemptPending || isSubscriptionPending : false);
  const hasFinishedAttempt = Boolean(
    attemptData && effectiveStatus !== "in-progress"
  );

  const setDialogOpen = useCallback(
    (open: boolean) => {
      if (open) {
        openDialog();
        return;
      }

      closeDialog();
    },
    [closeDialog, openDialog]
  );

  const clickCta = useCallback(() => {
    if (!user) {
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    if (resumePartKey) {
      router.push(`/try-out/${product}/${tryoutSlug}/part/${resumePartKey}`);
      return;
    }

    if (hasSubscription === false) {
      startTransition(async () => {
        const { url } = await generateCheckoutLink({
          productIds: [products.pro.id],
          successUrl: window.location.href,
        });

        window.location.href = url;
      });
      return;
    }

    openDialog();
  }, [
    openDialog,
    generateCheckoutLink,
    hasSubscription,
    resumePartKey,
    pathname,
    product,
    router,
    tryoutSlug,
    user,
  ]);

  const confirmStart = useCallback(() => {
    startTransition(async () => {
      try {
        await startTryout({ locale, product, tryoutSlug });

        closeDialog();

        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(tTryouts("start-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [closeDialog, locale, product, startTryout, tTryouts, tryoutSlug]);

  return useMemo(
    () => ({
      actions: {
        clickCta,
        confirmStart,
        setDialogOpen,
      },
      meta: {
        isActionPending,
        isDialogOpen,
      },
      state: {
        attemptData,
        effectiveStatus,
        hasSubscription,
        hasFinishedAttempt,
        isReady,
        isLoading,
        resumePartKey,
        remainingTime,
      },
    }),
    [
      clickCta,
      confirmStart,
      attemptData,
      effectiveStatus,
      hasSubscription,
      hasFinishedAttempt,
      isReady,
      isActionPending,
      isDialogOpen,
      isLoading,
      resumePartKey,
      remainingTime,
      setDialogOpen,
    ]
  );
}

export type TryoutStartValue = ReturnType<typeof useTryoutStartValue>;
