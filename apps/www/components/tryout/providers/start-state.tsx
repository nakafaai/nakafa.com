"use client";

import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
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
import type { TryoutAttemptStateValue } from "@/components/tryout/hooks/use-attempt-state";
import { useTryoutAttemptState } from "@/components/tryout/providers/attempt-state";
import { useUser } from "@/lib/context/use-user";

interface TryoutStartContextValue {
  actions: {
    clickCtaAction: () => void;
    confirmStartAction: () => void;
    setDialogOpenAction: (open: boolean) => void;
  };
  meta: {
    isActionPending: boolean;
    isDialogOpen: boolean;
  };
  state: {
    attempt:
      | NonNullable<TryoutAttemptStateValue["attemptData"]>["attempt"]
      | null;
    attemptStatus: TryoutAttemptStateValue["effectiveStatus"];
    hasFinishedAttempt: boolean;
    hasAccess: boolean | undefined;
    isLoading: boolean;
    isReady: boolean;
    remainingTime: TryoutAttemptStateValue["remainingTime"];
    resumePartKey: TryoutAttemptStateValue["resumePartKey"];
  };
}

const TryoutStartContext = createContext<TryoutStartContextValue | null>(null);

function useTryoutStartValue(): TryoutStartContextValue {
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();
  const [isActionPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const attemptData = useTryoutAttemptState((state) => state.attemptData);
  const attemptStatus = useTryoutAttemptState((state) => state.effectiveStatus);
  const isAttemptPending = useTryoutAttemptState(
    (state) => state.isAttemptPending
  );
  const locale = useTryoutAttemptState((state) => state.params.locale);
  const product = useTryoutAttemptState((state) => state.params.product);
  const remainingTime = useTryoutAttemptState((state) => state.remainingTime);
  const resumePartKey = useTryoutAttemptState((state) => state.resumePartKey);
  const tryoutSlug = useTryoutAttemptState((state) => state.params.tryoutSlug);
  const { data: hasAccess, isPending: isAccessPending } = useQueryWithStatus(
    api.tryoutAccess.queries.getTryoutAccessState,
    !isUserPending && user
      ? {
          product,
        }
      : "skip"
  );
  const startTryout = useMutation(api.tryouts.mutations.attempts.startTryout);
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const isReady = !(
    isUserPending ||
    (user && (isAttemptPending || isAccessPending))
  );
  const isLoading =
    isActionPending ||
    isUserPending ||
    (user ? isAttemptPending || isAccessPending : false);
  const hasFinishedAttempt = Boolean(
    attemptData && attemptStatus !== "in-progress"
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

    if (hasAccess === false) {
      startTransition(async () => {
        try {
          const { url } = await generateCheckoutLink({
            productIds: [products.pro.id],
            successUrl: window.location.href,
          });

          window.location.href = url;
        } catch {
          toast.error(tTryouts("start-error"), {
            position: "bottom-center",
          });
        }
      });
      return;
    }

    openDialog();
  }, [
    openDialog,
    generateCheckoutLink,
    hasAccess,
    pathname,
    product,
    resumePartKey,
    router,
    tTryouts,
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
        attempt: attemptData?.attempt ?? null,
        attemptStatus,
        hasFinishedAttempt,
        hasAccess,
        isLoading,
        isReady,
        remainingTime,
        resumePartKey,
      },
    }),
    [
      attemptData,
      attemptStatus,
      clickCtaAction,
      confirmStartAction,
      hasAccess,
      hasFinishedAttempt,
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

/** Selects a slice of the current tryout start state. */
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
