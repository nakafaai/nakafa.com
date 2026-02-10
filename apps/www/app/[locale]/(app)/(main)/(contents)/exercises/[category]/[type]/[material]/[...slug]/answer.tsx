"use client";

import { Link05Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import { cn, slugify } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

interface Props {
  children: React.ReactNode;
  exerciseNumber: number;
}

export function ExerciseAnswer({ children, exerciseNumber }: Props) {
  const t = useTranslations("Exercises");
  const showAnswer = useExercise(
    (state) => state.visibleExplanations[exerciseNumber] ?? false
  );

  const mustHide = useAttempt(
    (state) =>
      state.attempt?.status === "in-progress" &&
      state.attempt?.mode === "simulation"
  );

  const id = slugify(`${t("explanation")}-${exerciseNumber}`);

  return (
    <section
      className={cn(
        "space-y-6",
        showAnswer ? "visible" : "hidden",
        mustHide && "hidden"
      )}
    >
      <Separator orientation="horizontal" />
      <div className="space-y-6">
        <h3 className="scroll-mt-44 font-medium text-lg" id={id}>
          <a
            aria-label={`Link to ${t("explanation")}`}
            className="group/heading inline-flex items-center gap-4"
            href={`#${id}`}
            title={t("explanation")}
          >
            <span className="text-pretty">{t("explanation")}</span>
            <div className="rounded-sm border p-2 opacity-0 transition-opacity ease-out group-hover/heading:opacity-100">
              <HugeIcons
                className="size-4 shrink-0 text-muted-foreground"
                icon={Link05Icon}
              />
            </div>
          </a>
        </h3>
        {children}
      </div>
    </section>
  );
}
