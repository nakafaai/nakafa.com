"use client";

import { Rocket01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Countdown } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/attempt-countdown";
import { ExerciseStats } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/attempt-stats";
import { TryoutStartButton } from "@/components/tryout/start-button";
import { AttemptProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { useUser } from "@/lib/context/use-user";
import { useExerciseTimer } from "@/lib/hooks/use-exercise-timer";

interface TryoutPartRuntimeProps {
  children: ReactNode;
  locale: Locale;
  partKey: string;
  partLabel: string;
  product: TryoutProduct;
  questionCount: number;
  setSlug: string;
  timeLimitSeconds: number;
  tryoutSlug: string;
}

type TryoutPartRuntimeState = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutPartAttempt
>;

export function TryoutPartRuntime({
  children,
  locale,
  partKey,
  partLabel,
  product,
  questionCount,
  setSlug,
  timeLimitSeconds,
  tryoutSlug,
}: TryoutPartRuntimeProps) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const { data: partState, isPending: isPartStatePending } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutPartAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug, partKey } : "skip"
  );
  const { data: answerSheet, isPending: isAnswerSheetPending } =
    useQueryWithStatus(
      api.exercises.queries.getQuestionAnswerSheetBySlug,
      !isUserPending && user ? { locale, slug: setSlug } : "skip"
    );

  const attempt = partState?.partAttempt?.setAttempt ?? null;
  const answers = partState?.partAttempt?.answers ?? [];
  const shouldRenderQuestions = attempt?.status === "in-progress";
  const isRuntimePending =
    isUserPending ||
    (user ? isPartStatePending || isAnswerSheetPending : false);
  const shouldShowQuestions = !isRuntimePending && shouldRenderQuestions;

  return (
    <ExerciseContextProvider slug={setSlug}>
      <AttemptProvider
        value={{
          answerSheet: answerSheet ?? [],
          answers,
          attempt,
          slug: setSlug,
        }}
      >
        <div className="space-y-12">
          <TryoutPartHero
            isRuntimePending={isRuntimePending}
            locale={locale}
            partKey={partKey}
            partLabel={partLabel}
            product={product}
            questionCount={questionCount}
            runtime={partState}
            timeLimitSeconds={timeLimitSeconds}
            tryoutSlug={tryoutSlug}
          />

          {shouldShowQuestions ? children : null}
        </div>
      </AttemptProvider>
    </ExerciseContextProvider>
  );
}

function TryoutPartHero({
  locale,
  partKey,
  partLabel,
  product,
  questionCount,
  runtime,
  timeLimitSeconds,
  tryoutSlug,
  isRuntimePending,
}: {
  locale: Locale;
  partKey: string;
  partLabel: string;
  product: TryoutProduct;
  questionCount: number;
  runtime: TryoutPartRuntimeState | undefined;
  timeLimitSeconds: number;
  tryoutSlug: string;
  isRuntimePending: boolean;
}) {
  const tTryouts = useTranslations("Tryouts");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const user = useUser((state) => state.user);
  const startPart = useMutation(api.tryouts.mutations.attempts.startPart);
  const completePart = useMutation(api.tryouts.mutations.attempts.completePart);

  const partAttempt = runtime?.partAttempt;
  const partCompleted =
    !!partAttempt &&
    runtime.completedPartIndices.includes(partAttempt.partIndex);
  const hasStartedTryout = runtime !== undefined && runtime !== null;
  const tryoutInProgress = runtime?.tryoutAttempt.status === "in-progress";
  const timer = useExerciseTimer({
    attempt: partAttempt?.setAttempt ?? null,
    onExpire: async () => {
      if (!(runtime && partAttempt)) {
        return;
      }

      try {
        await completePart({
          tryoutAttemptId: runtime.tryoutAttempt._id,
          partKey,
        });
        router.push(`/try-out/${product}/${tryoutSlug}`);
      } catch {
        toast.error(tTryouts("complete-part-error"), {
          position: "bottom-center",
        });
      }
    },
  });

  const canStartPart = Boolean(
    tryoutInProgress && !partAttempt && !partCompleted
  );
  const canContinuePart = Boolean(
    partAttempt && partAttempt.setAttempt.status === "in-progress"
  );
  const shouldShowTryoutStartButton = !(
    isRuntimePending ||
    (user && hasStartedTryout)
  );

  const description = useMemo(() => {
    if (isRuntimePending) {
      return tTryouts("part-loading-description");
    }

    if (!hasStartedTryout) {
      return tTryouts("part-start-tryout-description", { part: partLabel });
    }

    if (!tryoutInProgress) {
      return tTryouts("part-tryout-ended-description", { part: partLabel });
    }

    if (partCompleted) {
      return tTryouts("part-completed-description", { part: partLabel });
    }

    if (canContinuePart) {
      return tTryouts("part-continue-description", { part: partLabel });
    }

    return tTryouts("part-start-description", {
      part: partLabel,
      count: questionCount,
    });
  }, [
    canContinuePart,
    hasStartedTryout,
    isRuntimePending,
    partCompleted,
    partLabel,
    questionCount,
    tryoutInProgress,
    tTryouts,
  ]);

  const handleStartPart = () => {
    if (!runtime) {
      return;
    }

    startTransition(async () => {
      try {
        await startPart({
          tryoutAttemptId: runtime.tryoutAttempt._id,
          partKey,
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
  };

  const handleCompletePart = () => {
    if (!(runtime && partAttempt)) {
      return;
    }

    startTransition(async () => {
      try {
        await completePart({
          tryoutAttemptId: runtime.tryoutAttempt._id,
          partKey,
        });
        setOpen(false);
        router.push(`/try-out/${product}/${tryoutSlug}`);
        toast.success(tTryouts("complete-part-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(tTryouts("complete-part-error"), {
          position: "bottom-center",
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {partAttempt && !partCompleted ? (
        <div className="sticky top-18 z-1 lg:top-2">
          <div className="flex flex-col rounded-xl border bg-card p-2 shadow-sm">
            <div className="flex items-center justify-between">
              <Countdown timer={timer} />

              <Button
                onClick={() => setOpen(true)}
                type="button"
                variant="destructive"
              >
                <Spinner icon={StopIcon} isLoading={isPending} />
                {tTryouts("complete-part-cta")}
              </Button>
            </div>

            <ExerciseStats />
          </div>
        </div>
      ) : null}

      <section className="max-w-2xl rounded-2xl border bg-card px-5 py-4 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {isRuntimePending ? (
              <Skeleton className="h-7 w-20 rounded-md" />
            ) : null}
            {!isRuntimePending && partCompleted ? (
              <Badge variant="muted">{tTryouts("part-status-completed")}</Badge>
            ) : null}
            {!isRuntimePending && canContinuePart ? (
              <Badge variant="muted">
                {tTryouts("part-status-in-progress")}
              </Badge>
            ) : null}
            {isRuntimePending || partCompleted || canContinuePart ? null : (
              <Badge variant="muted">
                <NumberFormat value={questionCount} />{" "}
                {tTryouts("question-unit")}
              </Badge>
            )}
            {isRuntimePending ? (
              <Skeleton className="h-7 w-20 rounded-md" />
            ) : (
              <Badge variant="muted">{formatTimeLimit(timeLimitSeconds)}</Badge>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {isRuntimePending ? (
              <div className="max-w-2xl space-y-2">
                <Skeleton className="h-4 w-72 rounded-sm" />
                <Skeleton className="h-4 w-56 rounded-sm" />
              </div>
            ) : (
              <p className="max-w-2xl text-muted-foreground">{description}</p>
            )}

            <div className="flex flex-wrap gap-3">
              {shouldShowTryoutStartButton ? (
                <TryoutStartButton
                  locale={locale}
                  product={product}
                  tryoutSlug={tryoutSlug}
                />
              ) : null}

              {!isRuntimePending && canStartPart ? (
                <Button
                  disabled={isPending}
                  onClick={handleStartPart}
                  type="button"
                >
                  <Spinner icon={Rocket01Icon} isLoading={isPending} />
                  {tTryouts("start-part-cta")}
                </Button>
              ) : null}

              {!isRuntimePending && partCompleted ? (
                <Button
                  onClick={() =>
                    router.push(`/try-out/${product}/${tryoutSlug}`)
                  }
                  type="button"
                  variant="outline"
                >
                  {tTryouts("back-to-set-cta")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <ResponsiveDialog
        description={tTryouts("complete-part-description")}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {tTryouts("cancel-cta")}
            </Button>
            <Button
              disabled={isPending}
              onClick={handleCompletePart}
              type="button"
              variant="destructive"
            >
              <Spinner icon={StopIcon} isLoading={isPending} />
              {tTryouts("complete-part-cta")}
            </Button>
          </div>
        }
        open={open}
        setOpen={setOpen}
        title={tTryouts("complete-part-title")}
      />
    </div>
  );
}

function formatTimeLimit(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}
