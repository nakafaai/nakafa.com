"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { useInterval } from "@mantine/hooks";
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
import type { ComponentProps, ReactNode } from "react";
import { useMemo, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
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

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;

type TryoutSetPartAttempt =
  NonNullable<TryoutAttemptData>["partAttempts"][number];

type TryoutSetPartBadgeStatus = ComponentProps<
  typeof TryoutStatusBadge
>["status"];

interface TryoutSetPartsProps {
  locale: Locale;
  parts: TryoutSetPartItem[];
  product: TryoutProduct;
  tryoutSlug: string;
}

interface TryoutSetPartsContextValue {
  state: {
    attemptData: TryoutAttemptData | undefined;
    isTryoutActive: boolean;
    product: TryoutProduct;
    questionUnitLabel: string;
    tryoutSlug: string;
  };
}

const TryoutSetPartsContext = createContext<TryoutSetPartsContextValue | null>(
  null
);

export function TryoutSetParts({
  locale,
  parts,
  product,
  tryoutSlug,
}: TryoutSetPartsProps) {
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { data: attemptData } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug } : "skip"
  );

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    1000,
    { autoInvoke: true }
  );

  const hasExpired = Boolean(
    attemptData?.attempt.status === "in-progress" &&
      attemptData.expiresAtMs <= nowMs
  );
  const isTryoutActive =
    attemptData?.attempt.status === "in-progress" && !hasExpired;

  return (
    <TryoutSetPartsProvider
      attemptData={attemptData ?? undefined}
      isTryoutActive={isTryoutActive}
      product={product}
      questionUnitLabel={tTryouts("question-unit")}
      tryoutSlug={tryoutSlug}
    >
      <TryoutSetPartsList>
        {parts.map((part) => (
          <TryoutSetPart key={part.partKey} part={part} />
        ))}
      </TryoutSetPartsList>
    </TryoutSetPartsProvider>
  );
}

function TryoutSetPartsProvider({
  attemptData,
  children,
  isTryoutActive,
  product,
  questionUnitLabel,
  tryoutSlug,
}: {
  attemptData: TryoutAttemptData | undefined;
  children: ReactNode;
  isTryoutActive: boolean;
  product: TryoutProduct;
  questionUnitLabel: string;
  tryoutSlug: string;
}) {
  const value = useMemo(
    () => ({
      state: {
        attemptData,
        isTryoutActive,
        product,
        questionUnitLabel,
        tryoutSlug,
      },
    }),
    [attemptData, isTryoutActive, product, questionUnitLabel, tryoutSlug]
  );

  return (
    <TryoutSetPartsContext.Provider value={value}>
      {children}
    </TryoutSetPartsContext.Provider>
  );
}

function TryoutSetPartsList({ children }: { children: ReactNode }) {
  return <div className="grid divide-y">{children}</div>;
}

function TryoutSetPart({ part }: { part: TryoutSetPartItem }) {
  const {
    attemptData,
    isTryoutActive,
    product,
    questionUnitLabel,
    tryoutSlug,
  } = useTryoutSetParts((context) => context.state);
  const partIcon = getTryoutPartIcon(part.material);
  const partAttempt = getTryoutPartAttempt(attemptData, part.partKey);
  const badgeStatus = getTryoutPartBadgeStatus({
    isTryoutActive,
    partAttempt,
  });
  const isCurrent =
    isTryoutActive &&
    attemptData?.nextPartKey === part.partKey &&
    badgeStatus !== "completed";

  return (
    <NavigationLink
      className={cn(
        "group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
        isCurrent && "bg-accent/20 hover:bg-accent"
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
            {badgeStatus ? <TryoutStatusBadge status={badgeStatus} /> : null}
          </div>
          <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground">
            {part.questionCount} {questionUnitLabel}
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
}

function useTryoutSetParts<T>(
  selector: (context: TryoutSetPartsContextValue) => T
) {
  const context = useContextSelector(TryoutSetPartsContext, (value) => value);

  if (!context) {
    throw new Error("useTryoutSetParts must be used within TryoutSetParts");
  }

  return selector(context);
}

function getTryoutPartIcon(material: string) {
  const parsedMaterial = ExercisesMaterialSchema.safeParse(material);

  if (!parsedMaterial.success) {
    return null;
  }

  return getMaterialIcon(parsedMaterial.data);
}

function getTryoutPartAttempt(
  attemptData: TryoutAttemptData | undefined,
  partKey: string
) {
  return attemptData?.partAttempts.find(
    (attempt) => attempt.partKey === partKey
  );
}

function getTryoutPartBadgeStatus({
  isTryoutActive,
  partAttempt,
}: {
  isTryoutActive: boolean;
  partAttempt: TryoutSetPartAttempt | undefined;
}): TryoutSetPartBadgeStatus | null {
  if (partAttempt?.isFinalized) {
    return "completed";
  }

  if (partAttempt?.setAttempt.status === "in-progress" && isTryoutActive) {
    return "in-progress";
  }

  return null;
}
