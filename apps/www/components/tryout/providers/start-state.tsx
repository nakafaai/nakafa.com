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
import {
  type PropsWithChildren,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutAttemptState } from "@/components/tryout/providers/attempt-state";
import { useUser } from "@/lib/context/use-user";

type TryoutStartContextValue = ReturnType<typeof useTryoutStartValue>;

const TryoutStartContext = createContext<TryoutStartContextValue | null>(null);

/** Builds the shared state for the tryout start flow. */
export function useTryoutStartValue() {
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();
  const [isActionPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const attemptData = useTryoutAttemptState((state) => state.attemptData);
  const effectiveStatus = useTryoutAttemptState(
    (state) => state.effectiveStatus
  );
  const isAttemptPending = useTryoutAttemptState(
    (state) => state.isAttemptPending
  );
  const locale = useTryoutAttemptState((state) => state.params.locale);
  const product = useTryoutAttemptState((state) => state.params.product);
  const remainingTime = useTryoutAttemptState((state) => state.remainingTime);
  const resumePartKey = useTryoutAttemptState((state) => state.resumePartKey);
  const tryoutSlug = useTryoutAttemptState((state) => state.params.tryoutSlug);
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

  const setDialogOpenAction = useCallback(
    (open: boolean) => {
      if (open) {
        openDialog();
        return;
      }

      closeDialog();
    },
    [closeDialog, openDialog]
  );

  const clickCtaAction = useCallback(() => {
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

  const confirmStartAction = useCallback(() => {
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
        clickCtaAction,
        confirmStartAction,
        setDialogOpenAction,
      },
      meta: {
        isActionPending,
        isDialogOpen,
      },
      state: {
        attemptData,
        effectiveStatus,
        hasFinishedAttempt,
        hasSubscription,
        isLoading,
        isReady,
        remainingTime,
        resumePartKey,
      },
    }),
    [
      attemptData,
      clickCtaAction,
      confirmStartAction,
      effectiveStatus,
      hasFinishedAttempt,
      hasSubscription,
      isActionPending,
      isDialogOpen,
      isLoading,
      isReady,
      remainingTime,
      resumePartKey,
      setDialogOpenAction,
    ]
  );
}

export function TryoutStartProvider({ children }: PropsWithChildren) {
  const value = useTryoutStartValue();

  return (
    <TryoutStartContext.Provider value={value}>
      {children}
    </TryoutStartContext.Provider>
  );
}

/** Selects a slice of the current tryout start flow state. */
export function useTryoutStart<T>(
  selector: (state: TryoutStartContextValue) => T
) {
  return useContextSelector(TryoutStartContext, (context) => {
    if (!context) {
      throw new Error(
        "useTryoutStart must be used within a TryoutStartProvider"
      );
    }

    return selector(context);
  });
}
