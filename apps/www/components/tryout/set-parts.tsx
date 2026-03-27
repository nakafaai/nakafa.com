"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cn } from "@repo/design-system/lib/utils";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useTryoutAttemptState } from "@/components/tryout/providers/attempt-state";
import { TryoutStatusBadge } from "@/components/tryout/status-badge";
import { deriveTryoutSetPartState } from "@/components/tryout/utils/part-state";

type TryoutSetPartItem = Pick<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.tryouts.getTryoutDetails>
  >["parts"][number],
  "material" | "partKey" | "questionCount"
> & {
  label: string;
};

interface TryoutSetPartsProps {
  parts: TryoutSetPartItem[];
}

type TryoutSetPartState = ReturnType<typeof deriveTryoutSetPartState>;

export function TryoutSetParts({ parts }: TryoutSetPartsProps) {
  const attemptData = useTryoutAttemptState((state) => state.attemptData);
  const effectiveStatus = useTryoutAttemptState(
    (state) => state.effectiveStatus
  );
  const nowMs = useTryoutAttemptState((state) => state.nowMs);
  const product = useTryoutAttemptState((state) => state.params.product);
  const resumePartKey = useTryoutAttemptState((state) => state.resumePartKey);
  const tryoutSlug = useTryoutAttemptState((state) => state.params.tryoutSlug);

  return (
    <div className="grid divide-y">
      {parts.map((part) => {
        const partState = deriveTryoutSetPartState({
          attemptData,
          effectiveStatus,
          nowMs,
          partKey: part.partKey,
          resumePartKey,
        });

        return (
          <TryoutSetPart
            href={`/try-out/${product}/${tryoutSlug}/part/${part.partKey}`}
            key={part.partKey}
            part={part}
            partState={partState}
          />
        );
      })}
    </div>
  );
}

function TryoutSetPart({
  href,
  part,
  partState,
}: {
  href: string;
  part: TryoutSetPartItem;
  partState: TryoutSetPartState;
}) {
  const tTryouts = useTranslations("Tryouts");
  const effectiveStatus = useTryoutAttemptState(
    (state) => state.effectiveStatus
  );
  const partIcon = getTryoutPartIcon(part.material);
  const showPartStatusBadge = effectiveStatus === "in-progress";

  return (
    <NavigationLink
      className={cn(
        "group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
        partState.isCurrent && "bg-accent/20 hover:bg-accent"
      )}
      href={href}
    >
      <div className="grid w-full gap-4">
        <div className="flex flex-1 items-start gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
            <GradientBlock
              className="absolute inset-0"
              colorScheme="vibrant"
              intensity="medium"
              keyString={part.partKey}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {partIcon ? (
                <HugeIcons
                  className="size-4 text-background drop-shadow-md"
                  icon={partIcon}
                />
              ) : null}
            </div>
          </div>

          <div className="-mt-1 flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3>{part.label}</h3>
              {showPartStatusBadge && partState.status === "completed" ? (
                <TryoutStatusBadge status="completed" />
              ) : null}
              {showPartStatusBadge && partState.status === "in-progress" ? (
                <TryoutStatusBadge status="in-progress" />
              ) : null}
            </div>
            <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground">
              {part.questionCount} {tTryouts("question-unit")}
            </span>
          </div>

          <HugeIcons
            className={cn(
              "size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100",
              partState.isCurrent && "opacity-100"
            )}
            icon={ArrowRight02Icon}
          />
        </div>

        {partState.score ? (
          <TryoutSetPartScore
            correctAnswers={partState.score.correctAnswers}
            irtScore={partState.score.irtScore}
            totalQuestions={part.questionCount}
          />
        ) : null}
      </div>
    </NavigationLink>
  );
}

function TryoutSetPartScore({
  correctAnswers,
  irtScore,
  totalQuestions,
}: {
  correctAnswers: number;
  irtScore: number;
  totalQuestions: number;
}) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <div className="grid grid-cols-2 gap-x-8">
      <TryoutSetPartMetric label={tTryouts("score-label")}>
        <TryoutSetPartScoreNumber value={irtScore} />
      </TryoutSetPartMetric>

      <TryoutSetPartMetric label={tTryouts("correct-answers-label")}>
        <TryoutSetPartScoreFraction
          correct={correctAnswers}
          total={totalQuestions}
        />
      </TryoutSetPartMetric>
    </div>
  );
}

function TryoutSetPartMetric({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col text-left">
      <span className="text-muted-foreground text-xs group-hover:text-accent-foreground/80">
        {label}
      </span>
      {children}
    </div>
  );
}

function TryoutSetPartScoreNumber({ value }: { value: number }) {
  return (
    <div className="font-light font-mono text-foreground text-xl tabular-nums leading-none tracking-tighter group-hover:text-accent-foreground sm:text-2xl">
      <NumberFormat
        format={{ maximumFractionDigits: 0 }}
        trend={0}
        value={value}
      />
    </div>
  );
}

function TryoutSetPartScoreFraction({
  correct,
  total,
}: {
  correct: number;
  total: number;
}) {
  return (
    <NumberFormatGroup>
      <div className="flex items-center gap-1">
        <div className="font-light font-mono text-foreground text-xl tabular-nums leading-none tracking-tighter group-hover:text-accent-foreground sm:text-2xl">
          <NumberFormat
            format={{ maximumFractionDigits: 0 }}
            trend={0}
            value={correct}
          />
        </div>
        <span className="font-light font-mono text-muted-foreground text-xl leading-none group-hover:text-accent-foreground/80 sm:text-2xl">
          /
        </span>
        <div className="font-light font-mono text-foreground text-xl tabular-nums leading-none tracking-tighter group-hover:text-accent-foreground sm:text-2xl">
          <NumberFormat
            format={{ maximumFractionDigits: 0 }}
            trend={0}
            value={total}
          />
        </div>
      </div>
    </NumberFormatGroup>
  );
}

/** Resolves the icon used for a tryout part material. */
function getTryoutPartIcon(material: string) {
  const parsedMaterial = ExercisesMaterialSchema.safeParse(material);

  if (!parsedMaterial.success) {
    return null;
  }

  return getMaterialIcon(parsedMaterial.data);
}
