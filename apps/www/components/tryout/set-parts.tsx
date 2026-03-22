"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
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
  const tTryouts = useTranslations("Tryouts");
  const attemptData = useTryoutAttemptState((state) => state.attemptData);
  const effectiveStatus = useTryoutAttemptState(
    (state) => state.effectiveStatus
  );
  const nowMs = useTryoutAttemptState((state) => state.nowMs);
  const product = useTryoutAttemptState((state) => state.params.product);
  const resumePartKey = useTryoutAttemptState((state) => state.resumePartKey);
  const tryoutSlug = useTryoutAttemptState((state) => state.params.tryoutSlug);
  const questionUnitLabel = tTryouts("question-unit");

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
            questionUnitLabel={questionUnitLabel}
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
  questionUnitLabel,
}: {
  href: string;
  part: TryoutSetPartItem;
  partState: TryoutSetPartState;
  questionUnitLabel: string;
}) {
  const partIcon = getTryoutPartIcon(part.material);

  return (
    <NavigationLink
      className={cn(
        "group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
        partState.isCurrent && "bg-accent/20 hover:bg-accent"
      )}
      href={href}
    >
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
            {partState.status === "completed" ? (
              <TryoutStatusBadge status="completed" />
            ) : null}
            {partState.status === "in-progress" ? (
              <TryoutStatusBadge status="in-progress" />
            ) : null}
          </div>
          <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground">
            {part.questionCount} {questionUnitLabel}
          </span>
        </div>
      </div>

      <HugeIcons
        className={cn(
          "size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100",
          partState.isCurrent && "opacity-100"
        )}
        icon={ArrowRight02Icon}
      />
    </NavigationLink>
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
