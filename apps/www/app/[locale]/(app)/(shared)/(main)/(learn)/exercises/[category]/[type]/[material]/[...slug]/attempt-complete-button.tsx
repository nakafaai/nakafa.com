"use client";

import { ArrowDown01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Progress } from "@repo/design-system/components/ui/progress";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useTransition } from "react";
import { toast } from "sonner";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";
import { useUser } from "@/lib/context/use-user";

/**
 * Renders the completion controls for one exercise set.
 *
 * The completion dialog is transient UI, so it resets closed when Next hides
 * the page through Cache Components state preservation.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 * - Mantine `useDisclosure`:
 *   https://mantine.dev/hooks/use-disclosure/
 */
export function CompleteExerciseButton() {
  const t = useTranslations("Exercises");
  const [open, { close, open: openDialog, set }] = useDisclosure(false);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => close, [close]);

  const showStats = useExercise((state) => state.showStats);
  const setShowStats = useExercise((state) => state.setShowStats);
  const resetTimeSpent = useExercise((state) => state.resetTimeSpent);

  const user = useUser((state) => state.user);
  const attempt = useAttempt((state) => state.attempt);
  const answers = useAttempt((state) => state.answers);
  const completeAttempt = useMutation(api.exercises.mutations.completeAttempt);

  const answeredCount = answers.filter(
    (a) => a.selectedOptionId !== undefined || a.textAnswer !== undefined
  ).length;
  const totalCount = attempt?.totalExercises ?? 0;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  const handleComplete = () => {
    if (!user) {
      return;
    }

    startTransition(async () => {
      if (!attempt) {
        toast.error(t("complete-exercise-error"), {
          position: "bottom-center",
        });
        return;
      }

      try {
        await completeAttempt({ attemptId: attempt._id });
        close();
        resetTimeSpent();
        setShowStats(true);
      } catch (error) {
        captureException(error, {
          source: "exercise-complete-attempt",
        });

        toast.error(t("complete-exercise-error"), {
          position: "bottom-center",
        });
      }
    });
  };

  return (
    <ButtonGroup>
      <Button
        disabled={isPending}
        onClick={openDialog}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={StopIcon} />
        {t("complete")}
      </Button>
      <ButtonGroupSeparator />
      <Button
        aria-label="stats action"
        onClick={() => setShowStats(!showStats)}
        size="icon"
        variant="destructive"
      >
        <HugeIcons
          className={cn(
            "transition-transform ease-out",
            !!showStats && "rotate-180"
          )}
          icon={ArrowDown01Icon}
        />
      </Button>

      <ResponsiveDialog
        description={t("complete-exercise-description")}
        footer={
          <Button
            disabled={isPending}
            onClick={handleComplete}
            variant="destructive"
          >
            <Spinner icon={StopIcon} isLoading={isPending} />
            {t("complete")}
          </Button>
        }
        open={open}
        setOpen={set}
        title={t("complete-exercise-title")}
      >
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {t.rich("complete-exercise-stats", {
              answered: answeredCount,
              total: totalCount,
              mark: (children: React.ReactNode) => (
                <span className="font-medium text-foreground">{children}</span>
              ),
            })}
          </p>
          <Progress value={progress} />
        </div>
      </ResponsiveDialog>
    </ButtonGroup>
  );
}
