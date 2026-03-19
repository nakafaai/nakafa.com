"use client";

import { useInterval } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import type { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import type {
  TryoutPartPageState,
  TryoutPartUiStatus,
} from "@/components/tryout/utils/part-state";
import { deriveTryoutPartPageState } from "@/components/tryout/utils/part-state";
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

type TryoutPartQuery = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutPartAttempt
>;

type TryoutPartDialogSetter = ComponentProps<
  typeof ResponsiveDialog
>["setOpen"];

interface TryoutPartContextValue {
  actions: {
    completePart: () => void;
    goToSet: () => void;
    setCompleteDialogOpen: TryoutPartDialogSetter;
    startPart: () => void;
  };
  meta: {
    isActionPending: boolean;
    isCompleteDialogOpen: boolean;
  };
  state: {
    answers: TryoutPartPageState["answers"];
    attempt: TryoutPartPageState["attempt"];
    canStartPart: boolean;
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
  isRuntimePending,
  part,
  runtime,
  tryout,
}: {
  children: ReactNode;
  isRuntimePending: boolean;
  part: TryoutPartValue;
  runtime: TryoutPartQuery | undefined;
  tryout: TryoutValue;
}) {
  const tTryouts = useTranslations("Tryouts");
  const [isCompleteDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isActionPending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const router = useRouter();
  const user = useUser((state) => state.user);
  const startPart = useMutation(api.tryouts.mutations.attempts.startPart);
  const completePart = useMutation(api.tryouts.mutations.attempts.completePart);

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    1000,
    { autoInvoke: true }
  );

  const { answers, attempt, canStartPart, partEndReason, status } =
    deriveTryoutPartPageState({
      isRuntimePending,
      nowMs,
      partKey: part.key,
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
    onExpire: async () => {
      try {
        const didCompletePart = await completeCurrentPart();

        if (didCompletePart) {
          goToSet();
        }
      } catch {
        toast.error(tTryouts("complete-part-error"), {
          position: "bottom-center",
        });
      }
    },
  });

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
        router.refresh();
        toast.success(tTryouts("start-part-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(tTryouts("start-part-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [part.key, router, runtime, startPart, tTryouts]);

  const handleCompletePart = useCallback(() => {
    startTransition(async () => {
      try {
        const didCompletePart = await completeCurrentPart();

        if (!didCompletePart) {
          return;
        }

        setCompleteDialogOpen(false);
        goToSet();
        toast.success(tTryouts("complete-part-success"), {
          position: "bottom-center",
        });
      } catch {
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
        setCompleteDialogOpen,
        startPart: handleStartPart,
      },
      meta: {
        isActionPending,
        isCompleteDialogOpen,
      },
      state: {
        answers,
        attempt,
        canStartPart,
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
      isActionPending,
      isCompleteDialogOpen,
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

export function useTryoutPart<T>(
  selector: (state: TryoutPartContextValue) => T
) {
  const context = useContextSelector(TryoutPartContext, (value) => value);

  if (!context) {
    throw new Error("useTryoutPart must be used within a TryoutPartProvider");
  }

  return selector(context);
}
