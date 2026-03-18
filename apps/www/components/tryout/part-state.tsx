"use client";

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
  locale: Locale;
  product: TryoutProduct;
  slug: string;
}

type TryoutPartQuery = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutPartAttempt
>;

type TryoutPartState = NonNullable<TryoutPartQuery>;
type TryoutPartAttempt = TryoutPartState["partAttempt"];
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
    canContinuePart: boolean;
    canStartPart: boolean;
    hasStartedTryout: boolean;
    isRuntimePending: boolean;
    part: TryoutPartValue;
    partAttempt: TryoutPartAttempt | null;
    partCompleted: boolean;
    runtime: TryoutPartQuery | undefined;
    shouldShowTryoutStartButton: boolean;
    timer: ReturnType<typeof useExerciseTimer>;
    tryout: TryoutValue;
    tryoutInProgress: boolean;
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
  const router = useRouter();
  const user = useUser((state) => state.user);
  const startPart = useMutation(api.tryouts.mutations.attempts.startPart);
  const completePart = useMutation(api.tryouts.mutations.attempts.completePart);

  const partAttempt = runtime?.partAttempt ?? null;
  const partCompleted = Boolean(
    partAttempt && runtime?.completedPartIndices.includes(partAttempt.partIndex)
  );
  const hasStartedTryout = Boolean(runtime);
  const tryoutInProgress = runtime?.tryoutAttempt.status === "in-progress";
  const canStartPart = Boolean(
    tryoutInProgress && !partAttempt && !partCompleted
  );
  const canContinuePart = Boolean(
    partAttempt?.setAttempt.status === "in-progress"
  );
  const shouldShowTryoutStartButton = !(
    isRuntimePending ||
    (user && hasStartedTryout)
  );

  const goToSet = useCallback(() => {
    router.push(`/try-out/${tryout.product}/${tryout.slug}`);
  }, [router, tryout.product, tryout.slug]);

  const completeCurrentPart = useCallback(async () => {
    if (!(runtime && partAttempt)) {
      return false;
    }

    await completePart({
      partKey: part.key,
      tryoutAttemptId: runtime.tryoutAttempt._id,
    });

    return true;
  }, [completePart, part.key, partAttempt, runtime]);

  const timer = useExerciseTimer({
    attempt: partAttempt?.setAttempt ?? null,
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
        canContinuePart,
        canStartPart,
        hasStartedTryout,
        isRuntimePending,
        part,
        partAttempt,
        partCompleted,
        runtime,
        shouldShowTryoutStartButton,
        timer,
        tryout,
        tryoutInProgress,
      },
    }),
    [
      canContinuePart,
      canStartPart,
      goToSet,
      handleCompletePart,
      handleStartPart,
      hasStartedTryout,
      isActionPending,
      isCompleteDialogOpen,
      isRuntimePending,
      part,
      partAttempt,
      partCompleted,
      runtime,
      shouldShowTryoutStartButton,
      timer,
      tryout,
      tryoutInProgress,
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
