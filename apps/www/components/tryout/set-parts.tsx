"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTryoutAttemptState } from "@/components/tryout/hooks/use-attempt-state";
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
  locale: Locale;
  parts: TryoutSetPartItem[];
  product: TryoutProduct;
  tryoutSlug: string;
}

type TryoutSetPartsState = Pick<
  ReturnType<typeof useTryoutAttemptState>,
  "attemptData" | "effectiveStatus" | "nowMs" | "resumePartKey"
> & {
  product: TryoutProduct;
  questionUnitLabel: string;
  tryoutSlug: string;
};

export function TryoutSetParts({
  locale,
  parts,
  product,
  tryoutSlug,
}: TryoutSetPartsProps) {
  const tTryouts = useTranslations("Tryouts");
  const { attemptData, effectiveStatus, nowMs, resumePartKey } =
    useTryoutAttemptState({
      locale,
      product,
      tryoutSlug,
    });
  const state: TryoutSetPartsState = {
    attemptData,
    effectiveStatus,
    nowMs,
    product,
    questionUnitLabel: tTryouts("question-unit"),
    resumePartKey,
    tryoutSlug,
  };

  return (
    <div className="grid divide-y">
      {parts.map((part) => (
        <TryoutSetPart key={part.partKey} part={part} state={state} />
      ))}
    </div>
  );
}

function TryoutSetPart({
  part,
  state,
}: {
  part: TryoutSetPartItem;
  state: TryoutSetPartsState;
}) {
  const {
    attemptData,
    effectiveStatus,
    nowMs,
    product,
    questionUnitLabel,
    resumePartKey,
    tryoutSlug,
  } = state;
  const partIcon = getTryoutPartIcon(part.material);
  const partState = deriveTryoutSetPartState({
    attemptData,
    effectiveStatus,
    nowMs,
    partKey: part.partKey,
    resumePartKey,
  });

  return (
    <NavigationLink
      className={cn(
        "group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
        partState.isCurrent && "bg-accent/20 hover:bg-accent"
      )}
      href={`/try-out/${product}/${tryoutSlug}/part/${part.partKey}`}
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
