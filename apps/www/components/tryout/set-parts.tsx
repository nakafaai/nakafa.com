"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutStatusBadge } from "@/components/tryout/status-badge";
import { useUser } from "@/lib/context/use-user";

type TryoutSetPartItem = Pick<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.tryouts.getTryoutDetails>
  >["parts"][number],
  "material" | "partIndex" | "partKey" | "questionCount"
> & {
  label: string;
};

interface TryoutSetPartsProps {
  locale: Locale;
  parts: TryoutSetPartItem[];
  product: TryoutProduct;
  tryoutSlug: string;
}

export function TryoutSetParts({
  locale,
  parts,
  product,
  tryoutSlug,
}: TryoutSetPartsProps) {
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const { data: attemptData } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug } : "skip"
  );

  return (
    <div className="grid divide-y">
      {parts.map((part) => {
        const material = ExercisesMaterialSchema.safeParse(part.material);
        const partIcon = material.success
          ? getMaterialIcon(material.data)
          : null;
        const partAttempt = attemptData?.partAttempts.find(
          (attempt) => attempt.partKey === part.partKey
        );
        const isCompleted =
          attemptData?.completedPartIndices.includes(part.partIndex) ?? false;
        const isInProgress = partAttempt?.setAttempt.status === "in-progress";
        const isCurrent =
          attemptData?.nextPartKey === part.partKey && !isCompleted;
        let statusBadge: ReactNode = null;

        if (isCompleted) {
          statusBadge = <TryoutStatusBadge status="completed" />;
        } else if (isInProgress) {
          statusBadge = <TryoutStatusBadge status="in-progress" />;
        }

        return (
          <NavigationLink
            className={cn(
              "group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
              isCurrent && "bg-accent/20 hover:bg-accent"
            )}
            href={`/try-out/${product}/${tryoutSlug}/part/${part.partKey}`}
            key={part.partKey}
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
                  {!!partIcon && (
                    <HugeIcons
                      className="size-4 text-background drop-shadow-md"
                      icon={partIcon}
                    />
                  )}
                </div>
              </div>

              <div className="-mt-1 flex flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3>{part.label}</h3>
                  {statusBadge}
                </div>
                <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground">
                  {part.questionCount} {tTryouts("question-unit")}
                </span>
              </div>
            </div>

            <HugeIcons
              className={cn(
                "size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100",
                isCurrent && "opacity-100"
              )}
              icon={ArrowRight02Icon}
            />
          </NavigationLink>
        );
      })}
    </div>
  );
}
