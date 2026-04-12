"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useRouter } from "@repo/internationalization/src/navigation";
import { preloadedQueryResult } from "convex/nextjs";
import { type Preloaded, useConvexAuth, usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import {
  type PropsWithChildren,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import {
  completeTryoutPart,
  startTryoutPart,
} from "@/components/tryout/actions/part";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useTryoutStartFlow } from "@/components/tryout/hooks/use-tryout-start-flow";
import { tryoutSearchParsers } from "@/components/tryout/utils/attempt-search";
import type {
  TryoutPartPageState,
  TryoutPartUiStatus,
} from "@/components/tryout/utils/part-state";
import { deriveTryoutPartPageState } from "@/components/tryout/utils/part-state";
import {
  getTryoutHistoryHref,
  getTryoutSetHref,
} from "@/components/tryout/utils/routes";
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
  partKeys,
  runtime,
  tryout,
}: {
  hasAuthenticatedRoute: boolean;
  initialNowMs?: number;
  part: TryoutPartValue;
  partKeys: readonly string[];
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
    partKeys,
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
  const [selectedAttemptId] = useQueryState(
    "attempt",
    tryoutSearchParsers.attempt
  );
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
  const setHref = getTryoutHistoryHref(
    getTryoutSetHref({
      product: tryout.product,
      tryoutSlug: tryout.slug,
    }),
    selectedAttemptId
  );

  const goToSet = useCallback(() => {
    router.push(setHref);
  }, [router, setHref]);

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
      const result = await startTryoutPart({
        locale: tryout.locale,
        partKey: part.key,
        partKeys,
        product: tryout.product,
        tryoutAttemptId: runtime.tryoutAttempt._id,
        tryoutSlug: tryout.slug,
      });

      if (result.ok) {
        toast.success(tTryouts("start-part-success"), {
          position: "bottom-center",
        });
        return;
      }

      toast.error(tTryouts("start-part-error"), {
        position: "bottom-center",
      });
    });
  }, [
    part.key,
    partKeys,
    runtime,
    tTryouts,
    tryout.locale,
    tryout.product,
    tryout.slug,
  ]);

  const completePartAction = useCallback(() => {
    startTransition(async () => {
      if (!(runtime && attempt)) {
        return;
      }

      const result = await completeTryoutPart({
        locale: tryout.locale,
        partKey: part.key,
        partKeys,
        product: tryout.product,
        tryoutAttemptId: runtime.tryoutAttempt._id,
        tryoutSlug: tryout.slug,
      });

      if (result.ok) {
        goToSet();
        toast.success(tTryouts("complete-part-success"), {
          position: "bottom-center",
        });
        return;
      }

      if (
        result.code === "TRYOUT_EXPIRED" ||
        result.code === "TRYOUT_PART_EXPIRED"
      ) {
        toast.info(tTryouts("part-head-processing-expiry"), {
          position: "bottom-center",
        });
        return;
      }

      toast.error(tTryouts("complete-part-error"), {
        position: "bottom-center",
      });
    });
  }, [
    attempt,
    goToSet,
    part.key,
    partKeys,
    runtime,
    tTryouts,
    tryout.locale,
    tryout.product,
    tryout.slug,
  ]);

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

/** Resolves one part-route context from already available route state. */
function ResolvedTryoutPartProvider({
  children,
  hasAuthenticatedRoute,
  initialNowMs,
  part,
  partKeys,
  runtime,
  tryout,
}: PropsWithChildren<{
  hasAuthenticatedRoute: boolean;
  initialNowMs?: number;
  part: TryoutPartValue;
  partKeys: readonly string[];
  runtime: TryoutPartRuntime | null;
  tryout: TryoutValue;
}>) {
  const value = useResolvedTryoutPartValue({
    hasAuthenticatedRoute,
    initialNowMs,
    part,
    partKeys,
    runtime,
    tryout,
  });

  return (
    <TryoutPartContext.Provider value={value}>
      {children}
    </TryoutPartContext.Provider>
  );
}

/** Subscribes the authenticated part route to its live vanilla Convex query. */
function LivePreloadedTryoutPartProvider({
  children,
  initialNowMs,
  part,
  partKeys,
  preloadedRuntime,
  tryout,
}: PropsWithChildren<{
  initialNowMs?: number;
  part: TryoutPartValue;
  partKeys: readonly string[];
  preloadedRuntime: PreloadedTryoutPartRuntime;
  tryout: TryoutValue;
}>) {
  const runtime = usePreloadedQuery(preloadedRuntime) ?? null;

  return (
    <ResolvedTryoutPartProvider
      hasAuthenticatedRoute
      initialNowMs={initialNowMs}
      part={part}
      partKeys={partKeys}
      runtime={runtime}
      tryout={tryout}
    >
      {children}
    </ResolvedTryoutPartProvider>
  );
}

/** Hydrates one authenticated part route from its native Convex preload. */
function PreloadedTryoutPartProvider({
  children,
  initialNowMs,
  part,
  partKeys,
  preloadedRuntime,
  tryout,
}: PropsWithChildren<{
  initialNowMs?: number;
  part: TryoutPartValue;
  partKeys: readonly string[];
  preloadedRuntime: PreloadedTryoutPartRuntime;
  tryout: TryoutValue;
}>) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const initialRuntime = useMemo(
    () => preloadedQueryResult(preloadedRuntime),
    [preloadedRuntime]
  );

  /**
   * Keep the protected tryout runtime on vanilla Convex preloading.
   *
   * These part routes are allowed to survive external navigation through Next's
   * preserved UI model. We therefore keep the server snapshot visible while the
   * Convex auth client is still bootstrapping and only mount the live protected
   * query after auth is definitely ready.
   */
  if (isLoading) {
    return (
      <ResolvedTryoutPartProvider
        hasAuthenticatedRoute
        initialNowMs={initialNowMs}
        part={part}
        partKeys={partKeys}
        runtime={initialRuntime}
        tryout={tryout}
      >
        {children}
      </ResolvedTryoutPartProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <ResolvedTryoutPartProvider
        hasAuthenticatedRoute={false}
        initialNowMs={initialNowMs}
        part={part}
        partKeys={partKeys}
        runtime={null}
        tryout={tryout}
      >
        {children}
      </ResolvedTryoutPartProvider>
    );
  }

  return (
    <LivePreloadedTryoutPartProvider
      initialNowMs={initialNowMs}
      part={part}
      partKeys={partKeys}
      preloadedRuntime={preloadedRuntime}
      tryout={tryout}
    >
      {children}
    </LivePreloadedTryoutPartProvider>
  );
}

/** Provides the full part-route runtime and fallback start state. */
export function TryoutPartProvider({
  children,
  initialNowMs,
  part,
  partKeys,
  preloadedRuntime,
  tryout,
}: PropsWithChildren<{
  initialNowMs?: number;
  part: TryoutPartValue;
  partKeys: readonly string[];
  preloadedRuntime?: PreloadedTryoutPartRuntime;
  tryout: TryoutValue;
}>) {
  if (preloadedRuntime) {
    return (
      <PreloadedTryoutPartProvider
        initialNowMs={initialNowMs}
        part={part}
        partKeys={partKeys}
        preloadedRuntime={preloadedRuntime}
        tryout={tryout}
      >
        {children}
      </PreloadedTryoutPartProvider>
    );
  }

  return (
    <ResolvedTryoutPartProvider
      hasAuthenticatedRoute={false}
      initialNowMs={initialNowMs}
      part={part}
      partKeys={partKeys}
      runtime={null}
      tryout={tryout}
    >
      {children}
    </ResolvedTryoutPartProvider>
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
