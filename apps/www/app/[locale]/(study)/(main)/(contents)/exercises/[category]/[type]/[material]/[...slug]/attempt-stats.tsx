"use client";

import { BookOpen02Icon, Timer02Icon } from "@hugeicons/core-free-icons";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { Progress } from "@repo/design-system/components/ui/progress";
import { intervalToDuration } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

export function ExerciseStats() {
  const attempt = useAttempt((state) => state.attempt);
  const answers = useAttempt((state) => state.answers);
  const showStats = useExercise((state) => state.showStats);

  if (!attempt) {
    return null;
  }

  return (
    <AnimatePresence>
      {showStats && (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden pt-2"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={{ ease: "easeOut" }}
        >
          {attempt.status === "in-progress" ? (
            <StatsProgress answers={answers} attempt={attempt} />
          ) : (
            <StatsResult attempt={attempt} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatsResult({ attempt }: { attempt: Doc<"exerciseAttempts"> }) {
  const t = useTranslations("Exercises");

  return (
    <section className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground text-sm">{t("score")}</div>
          <div className="font-medium text-lg tabular-nums">
            <NumberFormat suffix="%" value={attempt.scorePercentage} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground text-sm">{t("time")}</div>
          <div className="font-medium text-lg tabular-nums">
            {formatTime(attempt.totalTime)}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground text-sm">{t("correct")}</div>
          <div className="font-medium text-lg tabular-nums">
            <NumberFormat value={attempt.correctAnswers} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground text-sm">{t("answered")}</div>
          <NumberFormatGroup>
            <div className="flex items-baseline font-medium text-lg tabular-nums">
              <NumberFormat value={attempt.answeredCount} />
              <span className="mx-2 text-muted-foreground">/</span>
              <NumberFormat value={attempt.totalExercises} />
            </div>
          </NumberFormatGroup>
        </div>
      </div>
    </section>
  );
}

function formatTime(seconds: number): string {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });

  const parts: string[] = [];
  if (duration.hours && duration.hours > 0) {
    parts.push(`${duration.hours}h`);
  }
  if (duration.minutes && duration.minutes > 0) {
    parts.push(`${duration.minutes}m`);
  }
  if (duration.seconds && duration.seconds > 0) {
    parts.push(`${duration.seconds}s`);
  }

  return parts.length > 0 ? parts.join(" ") : "0s";
}

function StatsProgress({
  attempt,
  answers,
}: {
  attempt: Doc<"exerciseAttempts">;
  answers: Doc<"exerciseAnswers">[];
}) {
  const t = useTranslations("Exercises");

  const answeredCount = answers.filter(
    (a) => a.selectedOptionId !== undefined || a.textAnswer !== undefined
  ).length;
  const totalCount = attempt.totalExercises ?? 0;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center justify-between text-sm">
        <Badge variant="default-subtle">
          <HugeIcons
            icon={attempt.mode === "simulation" ? Timer02Icon : BookOpen02Icon}
          />
          {t(attempt.mode)}
        </Badge>

        <NumberFormatGroup>
          <div className="flex items-baseline text-sm tabular-nums">
            <NumberFormat value={answeredCount} />
            <span className="mx-2 text-muted-foreground">/</span>
            <NumberFormat value={totalCount} />
          </div>
        </NumberFormatGroup>
      </div>
      <Progress value={progress} />
    </div>
  );
}
