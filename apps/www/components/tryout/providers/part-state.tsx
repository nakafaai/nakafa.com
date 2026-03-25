"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import type {
  TryoutPartPageState,
  TryoutPartUiStatus,
} from "@/components/tryout/utils/part-state";
import { deriveTryoutPartPageState } from "@/components/tryout/utils/part-state";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import { useUser } from "@/lib/context/use-user";
import { useExerciseTimer } from "@/lib/hooks/use-exercise-timer";

export interface TryoutPartValue {
  key: string;
  label: string;
  questionCount: number;
  setSlug: string;
  timeLimitSeconds: number;
}

export interface TryoutValue {
  cycleKey: string;
  label: string;
  locale: Locale;
  product: TryoutProduct;
  slug: string;
}

interface TryoutPartContextValue {
  actions: {
    completePart: () => void;
    goToSet: () => void;
    startPart: () => void;
  };
  meta: {
    isActionPending: boolean;
  };
  state: {
    answers: TryoutPartPageState["answers"];
    attempt: TryoutPartPageState["attempt"];
    canStartPart: boolean;
    isAwaitingExpiry: boolean;
    isTryoutFinished: boolean;
    isRuntimePending: boolean;
    part: TryoutPartValue;
    partEndReason: TryoutPartPageState["partEndReason"];
    shouldShowTryoutStartButton: boolean;
    status: TryoutPartUiStatus;
    timer: ReturnType<typeof useExerciseTimer>;
    tryout: TryoutValue;
  };
}

const TryoutPartContext = createContext<TryoutPartContextValue | null>(null);

export function TryoutPartProvider({
  children,
  part,
  tryout,
}: {
  children: ReactNode;
  part: TryoutPartValue;
  tryout: TryoutValue;
}) {
  const tTryouts = useTranslations("Tryouts");
  const [isActionPending, startTransition] = useTransition();
  const router = useRouter();
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldLoadRuntime = !isUserPending && Boolean(user);
  const { data: runtime, isPending: isPartStatePending } = useQueryWithStatus(
    api.tryouts.queries.me.part.getUserTryoutPartAttempt,
    shouldLoadRuntime
      ? {
          locale: tryout.locale,
          partKey: part.key,
          product: tryout.product,
          tryoutSlug: tryout.slug,
        }
      : "skip"
  );
  const nowMs = useTryoutClock(
    Boolean(runtime && runtime.tryoutAttempt.status === "in-progress")
  );
  const isRuntimePending = isUserPending || (user ? isPartStatePending : false);
  const startPart = useMutation(api.tryouts.mutations.attempts.startPart);
  const completePart = useMutation(api.tryouts.mutations.attempts.completePart);

  const { answers, attempt, canStartPart, partEndReason, status } =
    deriveTryoutPartPageState({
      isRuntimePending,
      nowMs,
      runtime,
    });
  const shouldShowTryoutStartButton = !(isRuntimePending || (user && runtime));

  const goToSet = useCallback(() => {
    router.push(`/try-out/${tryout.product}/${tryout.slug}`);
  }, [router, tryout.product, tryout.slug]);

  const completeCurrentPart = useCallback(async () => {
    if (!(runtime && attempt)) {
      return false;
    }

    await completePart({
      partKey: part.key,
      tryoutAttemptId: runtime.tryoutAttempt._id,
    });

    return true;
  }, [attempt, completePart, part.key, runtime]);

  const timer = useExerciseTimer({
    attempt,
    expiresAtMs: runtime?.expiresAtMs,
    nowMs,
  });
  const isAwaitingExpiry = Boolean(
    attempt && attempt.status === "in-progress" && timer.isExpired
  );
  const isTryoutFinished = Boolean(
    runtime &&
      getEffectiveTryoutStatus({
        expiresAtMs: runtime.expiresAtMs,
        nowMs,
        status: runtime.tryoutAttempt.status,
      }) !== "in-progress"
  );

  const handleStartPart = useCallback(() => {
    if (!runtime) {
      return;
    }

    startTransition(async () => {
      try {
        await startPart({
          partKey: part.key,
          tryoutAttemptId: runtime.tryoutAttempt._id,
        });
        toast.success(tTryouts("start-part-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(tTryouts("start-part-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [part.key, runtime, startPart, tTryouts]);

  const handleCompletePart = useCallback(() => {
    startTransition(async () => {
      try {
        const didCompletePart = await completeCurrentPart();

        if (!didCompletePart) {
          return;
        }

        goToSet();
        toast.success(tTryouts("complete-part-success"), {
          position: "bottom-center",
        });
      } catch (error) {
        if (error instanceof ConvexError) {
          const errorData = error.data;

          if (typeof errorData === "object" && errorData !== null) {
            const errorCode = "code" in errorData ? errorData.code : undefined;

            if (
              errorCode === "TRYOUT_EXPIRED" ||
              errorCode === "TRYOUT_PART_EXPIRED"
            ) {
              toast.info(tTryouts("part-head-processing-expiry"), {
                position: "bottom-center",
              });
              return;
            }
          }
        }

        toast.error(tTryouts("complete-part-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [completeCurrentPart, goToSet, tTryouts]);

  const value = useMemo(
    () => ({
      actions: {
        completePart: handleCompletePart,
        goToSet,
        startPart: handleStartPart,
      },
      meta: {
        isActionPending,
      },
      state: {
        answers,
        attempt,
        canStartPart,
        isAwaitingExpiry,
        isTryoutFinished,
        isRuntimePending,
        part,
        partEndReason,
        shouldShowTryoutStartButton,
        status,
        timer,
        tryout,
      },
    }),
    [
      answers,
      attempt,
      canStartPart,
      goToSet,
      handleCompletePart,
      handleStartPart,
      isAwaitingExpiry,
      isTryoutFinished,
      isActionPending,
      isRuntimePending,
      part,
      partEndReason,
      shouldShowTryoutStartButton,
      status,
      timer,
      tryout,
    ]
  );

  return (
    <TryoutPartContext.Provider value={value}>
      {children}
    </TryoutPartContext.Provider>
  );
}

/** Selects a slice of the active tryout part context. */
export function useTryoutPart<T>(
  selector: (state: TryoutPartContextValue) => T
) {
  return useContextSelector(TryoutPartContext, (context) => {
    if (!context) {
      throw new Error("useTryoutPart must be used within a TryoutPartProvider");
    }

    return selector(context);
  });
}
