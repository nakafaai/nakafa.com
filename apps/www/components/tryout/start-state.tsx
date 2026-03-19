"use client";

import { useDisclosure, useInterval } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useMutation } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import {
  type PropsWithChildren,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useUser } from "@/lib/context/use-user";

export interface TryoutStartButtonProps {
  locale: Locale;
  product: TryoutProduct;
  tryoutSlug: string;
}

function useTryoutStartValue({
  locale,
  product,
  tryoutSlug,
}: TryoutStartButtonProps) {
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isActionPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const { data: attemptData, isPending: isAttemptPending } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug } : "skip"
  );
  const { data: hasSubscription, isPending: isSubscriptionPending } =
    useQueryWithStatus(
      api.subscriptions.queries.hasActiveSubscription,
      !isUserPending && user ? { productId: products.pro.id } : "skip"
    );
  const startTryout = useMutation(api.tryouts.mutations.attempts.startTryout);
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const tryout = useMemo(
    () => ({
      locale,
      product,
      slug: tryoutSlug,
    }),
    [locale, product, tryoutSlug]
  );
  const hasExpired = Boolean(
    attemptData?.attempt.status === "in-progress" &&
      attemptData.expiresAtMs <= nowMs
  );
  const nextPartKey =
    attemptData?.attempt.status === "in-progress" && !hasExpired
      ? attemptData.nextPartKey
      : undefined;
  const remainingTime = useMemo(() => {
    if (attemptData?.attempt.status !== "in-progress" || hasExpired) {
      return null;
    }

    const totalSeconds = Math.max(
      0,
      Math.floor((attemptData.expiresAtMs - nowMs) / 1000)
    );

    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }, [attemptData, hasExpired, nowMs]);
  const isReady = !(
    isUserPending ||
    (user && (isAttemptPending || isSubscriptionPending))
  );
  const isLoading =
    isActionPending ||
    isUserPending ||
    (user ? isAttemptPending || isSubscriptionPending : false);

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    1000,
    { autoInvoke: true }
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

    if (nextPartKey) {
      router.push(`/try-out/${product}/${tryoutSlug}/part/${nextPartKey}`);
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
    nextPartKey,
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
        router.refresh();
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(tTryouts("start-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [closeDialog, locale, product, router, startTryout, tTryouts, tryoutSlug]);

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
        hasSubscription,
        isReady,
        isLoading,
        nextPartKey,
        remainingTime,
        tryout,
      },
    }),
    [
      clickCta,
      confirmStart,
      hasSubscription,
      isReady,
      isActionPending,
      isDialogOpen,
      isLoading,
      nextPartKey,
      remainingTime,
      setDialogOpen,
      tryout,
    ]
  );
}

type TryoutStartContextValue = ReturnType<typeof useTryoutStartValue>;

const TryoutStartContext = createContext<TryoutStartContextValue | null>(null);

export function TryoutStartProvider({
  children,
  ...props
}: PropsWithChildren<TryoutStartButtonProps>) {
  const value = useTryoutStartValue(props);

  return (
    <TryoutStartContext.Provider value={value}>
      {children}
    </TryoutStartContext.Provider>
  );
}

export function useTryoutStart<T>(
  selector: (state: TryoutStartContextValue) => T
) {
  const context = useContextSelector(TryoutStartContext, (value) => value);

  if (!context) {
    throw new Error("useTryoutStart must be used within a TryoutStartProvider");
  }

  return selector(context);
}
