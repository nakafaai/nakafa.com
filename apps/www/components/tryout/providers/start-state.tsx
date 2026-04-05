"use client";

import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
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
  const startTryout = useMutation(api.tryouts.mutations.attempts.startTryout);
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const isReady = !(isUserPending || (user && isAttemptPending));
  const isLoading =
    isActionPending || isUserPending || (user ? isAttemptPending : false);
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

    openDialog();
  }, [openDialog, pathname, product, resumePartKey, router, tryoutSlug, user]);

  const confirmStartAction = useCallback(() => {
    startTransition(async () => {
      try {
        await startTryout({ locale, product, tryoutSlug });
        closeDialog();
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
      } catch (error) {
        if (error instanceof ConvexError) {
          const errorData = error.data;

          if (typeof errorData === "object" && errorData !== null) {
            const errorCode = "code" in errorData ? errorData.code : undefined;

            if (errorCode === "COMPETITION_ATTEMPT_ALREADY_USED") {
              closeDialog();
              toast.info(tTryouts("competition-attempt-used-error"), {
                position: "bottom-center",
              });
              return;
            }

            if (errorCode === "TRYOUT_ACCESS_REQUIRED") {
              try {
                const { url } = await generateCheckoutLink({
                  productIds: [products.pro.id],
                  successUrl: window.location.href,
                });

                window.location.href = url;
                return;
              } catch {
                toast.error(tTryouts("start-error"), {
                  position: "bottom-center",
                });
                return;
              }
            }
          }
        }

        toast.error(tTryouts("start-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [
    closeDialog,
    generateCheckoutLink,
    locale,
    product,
    startTryout,
    tTryouts,
    tryoutSlug,
  ]);

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
