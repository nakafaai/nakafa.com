"use client";

import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useRouter } from "@repo/internationalization/src/navigation";
import type { Preloaded } from "convex/react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import {
  type PropsWithChildren,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useTryoutStartFlow } from "@/components/tryout/hooks/use-tryout-start-flow";
import type {
  TryoutPartPageState,
  TryoutPartUiStatus,
} from "@/components/tryout/utils/part-state";
import { deriveTryoutPartPageState } from "@/components/tryout/utils/part-state";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
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
    clickTryoutStartAction: () => void;
    completePart: () => void;
    confirmTryoutStartAction: () => void;
    goToSet: () => void;
    setTryoutStartDialogOpenAction: (open: boolean) => void;
    startPart: () => void;
  };
  meta: {
    isActionPending: boolean;
    isStartBlocked: boolean;
    isTryoutStartDialogOpen: boolean;
  };
  state: {
    answers: TryoutPartPageState["answers"];
    attempt: TryoutPartPageState["attempt"];
    canStartPart: boolean;
    isAwaitingExpiry: boolean;
    isTryoutActive: boolean;
    isTryoutFinished: boolean;
    part: TryoutPartValue;
    partEndReason: TryoutPartPageState["partEndReason"];
    score: TryoutPartPageState["score"];
    shouldShowTryoutStartControls: boolean;
    status: TryoutPartUiStatus;
    timer: ReturnType<typeof useExerciseTimer>;
    tryoutAttemptStatus: TryoutPartPageState["tryoutAttemptStatus"];
    tryoutPublicResultStatus: TryoutPartPageState["tryoutPublicResultStatus"];
    tryout: TryoutValue;
  };
}

type TryoutPartRuntime = FunctionReturnType<
  typeof api.tryouts.queries.me.part.getUserTryoutPartAttempt
>;
type PreloadedTryoutPartRuntime = Preloaded<
  typeof api.tryouts.queries.me.part.getUserTryoutPartAttempt
>;

const TryoutPartContext = createContext<TryoutPartContextValue | null>(null);

/** Builds the full part-route state from one server-owned runtime snapshot. */
function useResolvedTryoutPartValue({
  hasAuthenticatedRoute,
  initialNowMs,
  part,
  runtime,
  tryout,
}: {
  hasAuthenticatedRoute: boolean;
  initialNowMs?: number;
  part: TryoutPartValue;
  runtime: TryoutPartRuntime | null;
  tryout: TryoutValue;
}) {
  const tTryouts = useTranslations("Tryouts");
  const router = useRouter();
  const [isActionPending, startTransition] = useTransition();
  const {
    clickStartAction,
    confirmStartAction,
    isDialogOpen,
    isStartBlocked,
    setDialogOpenAction,
  } = useTryoutStartFlow({
    access: hasAuthenticatedRoute ? "authenticated" : "anonymous",
    params: {
      locale: tryout.locale,
      product: tryout.product,
      tryoutSlug: tryout.slug,
    },
  });
  const nowMs = useTryoutClock(
    Boolean(runtime && runtime.tryoutAttempt.status === "in-progress"),
    initialNowMs
  );
  const startPart = useMutation(api.tryouts.mutations.attempts.startPart);
  const completePart = useMutation(api.tryouts.mutations.attempts.completePart);
  const {
    answers,
    attempt,
    canStartPart,
    partEndReason,
    score,
    status,
    tryoutAttemptStatus,
    tryoutPublicResultStatus,
  } = deriveTryoutPartPageState({
    nowMs,
    runtime,
  });
  const shouldShowTryoutStartControls = status === "needs-tryout";

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
  const isTryoutActive = tryoutAttemptStatus === "in-progress";
  const isTryoutFinished = Boolean(
    runtime &&
      getEffectiveTryoutStatus({
        expiresAtMs: runtime.expiresAtMs,
        nowMs,
        status: runtime.tryoutAttempt.status,
      }) !== "in-progress"
  );

  const startPartAction = useCallback(() => {
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

  const completePartAction = useCallback(() => {
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

  return useMemo(
    () => ({
      actions: {
        clickTryoutStartAction: clickStartAction,
        completePart: completePartAction,
        confirmTryoutStartAction: confirmStartAction,
        goToSet,
        setTryoutStartDialogOpenAction: setDialogOpenAction,
        startPart: startPartAction,
      },
      meta: {
        isActionPending,
        isStartBlocked,
        isTryoutStartDialogOpen: isDialogOpen,
      },
      state: {
        answers,
        attempt,
        canStartPart,
        isAwaitingExpiry,
        isTryoutActive,
        isTryoutFinished,
        part,
        partEndReason,
        score,
        shouldShowTryoutStartControls,
        status,
        timer,
        tryout,
        tryoutAttemptStatus,
        tryoutPublicResultStatus,
      },
    }),
    [
      answers,
      attempt,
      canStartPart,
      clickStartAction,
      completePartAction,
      confirmStartAction,
      goToSet,
      isActionPending,
      isAwaitingExpiry,
      isDialogOpen,
      isStartBlocked,
      isTryoutActive,
      isTryoutFinished,
      part,
      partEndReason,
      score,
      setDialogOpenAction,
      shouldShowTryoutStartControls,
      startPartAction,
      status,
      timer,
      tryout,
      tryoutAttemptStatus,
      tryoutPublicResultStatus,
    ]
  );
}

/** Hydrates one authenticated part route from its server-preloaded runtime. */
function PreloadedTryoutPartProvider({
  children,
  initialNowMs,
  part,
  preloadedRuntime,
  tryout,
}: PropsWithChildren<{
  initialNowMs?: number;
  part: TryoutPartValue;
  preloadedRuntime: PreloadedTryoutPartRuntime;
  tryout: TryoutValue;
}>) {
  const runtime = usePreloadedAuthQuery(preloadedRuntime) ?? null;
  const value = useResolvedTryoutPartValue({
    hasAuthenticatedRoute: true,
    initialNowMs,
    part,
    runtime,
    tryout,
  });

  return (
    <TryoutPartContext.Provider value={value}>
      {children}
    </TryoutPartContext.Provider>
  );
}

/** Provides the anonymous part route state when no authenticated runtime exists. */
function AnonymousTryoutPartProvider({
  children,
  initialNowMs,
  part,
  tryout,
}: PropsWithChildren<{
  initialNowMs?: number;
  part: TryoutPartValue;
  tryout: TryoutValue;
}>) {
  const value = useResolvedTryoutPartValue({
    hasAuthenticatedRoute: false,
    initialNowMs,
    part,
    runtime: null,
    tryout,
  });

  return (
    <TryoutPartContext.Provider value={value}>
      {children}
    </TryoutPartContext.Provider>
  );
}

/** Provides the full part-route runtime and fallback start state. */
export function TryoutPartProvider({
  children,
  initialNowMs,
  part,
  preloadedRuntime,
  tryout,
}: PropsWithChildren<{
  initialNowMs?: number;
  part: TryoutPartValue;
  preloadedRuntime?: PreloadedTryoutPartRuntime;
  tryout: TryoutValue;
}>) {
  if (preloadedRuntime) {
    return (
      <PreloadedTryoutPartProvider
        initialNowMs={initialNowMs}
        part={part}
        preloadedRuntime={preloadedRuntime}
        tryout={tryout}
      >
        {children}
      </PreloadedTryoutPartProvider>
    );
  }

  return (
    <AnonymousTryoutPartProvider
      initialNowMs={initialNowMs}
      part={part}
      tryout={tryout}
    >
      {children}
    </AnonymousTryoutPartProvider>
  );
}

/** Selects one slice of the active part-route state. */
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
