"use client";

import {
  ArrowDown01Icon,
  BookOpen02Icon,
  StartUp02Icon,
  StopWatchIcon,
  Tick01Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { formatDuration } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useState } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";
import { useUser } from "@/lib/context/use-user";
import { getLocale } from "@/lib/utils/date";

interface StartExerciseButtonProps {
  totalExercises: number;
}

const modeSchema = z.object({
  mode: z.enum(["simulation", "practice"]),
  timeLimit: z.number(),
});

const defaultValues = ({
  timeLimit,
}: {
  timeLimit: number;
}): z.input<typeof modeSchema> => ({
  mode: "simulation",
  timeLimit,
});

export function StartExerciseButton({
  totalExercises,
}: StartExerciseButtonProps) {
  const t = useTranslations("Exercises");
  const [open, setOpen] = useState(false);
  const locale = useLocale();

  const router = useRouter();
  const pathname = usePathname();

  const attempt = useAttempt((state) => state.attempt);
  const slug = useExercise((state) => state.slug);
  const showStats = useExercise((state) => state.showStats);
  const setShowStats = useExercise((state) => state.setShowStats);
  const resetTimeSpent = useExercise((state) => state.resetTimeSpent);

  const user = useUser((state) => state.user);
  const startAttempt = useMutation(api.exercises.mutations.startAttempt);

  const form = useForm({
    defaultValues: defaultValues({ timeLimit: totalExercises * 90 }),
    validators: {
      onChange: modeSchema,
    },
    onSubmit: async ({ value }) => {
      if (!user) {
        router.push(`/auth?redirect=${pathname}`);
        return;
      }

      const mode = value.mode;

      const timeLimit =
        mode === "simulation" ? totalExercises * 90 : value.timeLimit;

      try {
        await startAttempt({
          slug,
          mode,
          scope: "set",
          totalExercises,
          timeLimit,
        });
        setOpen(false);
        resetTimeSpent();
        setShowStats(true);
        toast.success(t("start-exercise-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(t("start-exercise-error"), {
          position: "bottom-center",
        });
      }
    },
  });

  return (
    <form
      id="exercise-attempt-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ButtonGroup>
        <Button onClick={() => setOpen(true)} type="button">
          <HugeIcons icon={StartUp02Icon} />
          {t("start")}
        </Button>

        {attempt && (
          <>
            <ButtonGroupSeparator />
            <Button
              aria-label="stats action"
              onClick={() => setShowStats(!showStats)}
              size="icon"
              type="button"
            >
              <HugeIcons
                className={cn(
                  "transition-transform ease-out",
                  !!showStats && "rotate-180"
                )}
                icon={ArrowDown01Icon}
              />
            </Button>
          </>
        )}
      </ButtonGroup>

      <ResponsiveDialog
        description={t("start-exercise-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form="exercise-attempt-form"
                type="submit"
              >
                <Spinner icon={StartUp02Icon} isLoading={isSubmitting} />
                {t("start")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpen}
        title={t("start-exercise-title")}
      >
        <FieldGroup>
          <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
            <form.Field name="mode">
              {(field) =>
                (["simulation", "practice"] as const).map((mode) => (
                  <button
                    className={cn(
                      "group flex cursor-pointer items-start gap-4 bg-card p-4 text-card-foreground transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
                      field.state.value === mode && "bg-accent/50"
                    )}
                    key={mode}
                    onClick={() => field.handleChange(mode)}
                    type="button"
                  >
                    <div className="flex flex-1 flex-col items-start justify-start gap-1">
                      <div className="flex items-center gap-2">
                        <HugeIcons
                          className="size-4 shrink-0"
                          icon={
                            mode === "simulation" ? Timer02Icon : BookOpen02Icon
                          }
                        />
                        <span className="font-medium text-sm">{t(mode)}</span>
                      </div>
                      <p className="text-start text-muted-foreground text-sm group-hover:text-accent-foreground/80">
                        {t(`${mode}-description`)}
                      </p>
                    </div>

                    <HugeIcons
                      className={cn(
                        "size-4 shrink-0 text-primary opacity-0 transition-opacity ease-out",
                        field.state.value === mode && "opacity-100"
                      )}
                      icon={Tick01Icon}
                    />
                  </button>
                ))
              }
            </form.Field>
          </div>

          <form.Subscribe selector={(state) => [state.values.mode]}>
            {([mode]) => (
              <Activity mode={mode === "practice" ? "visible" : "hidden"}>
                <form.Field name="timeLimit">
                  {(field) => {
                    const isInvalid =
                      Boolean(field.state.meta.isTouched) &&
                      Boolean(!field.state.meta.isValid);
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="time-limit">
                          {t("time-limit-label")}
                        </FieldLabel>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-invalid={isInvalid}
                              className="w-full font-normal"
                              id="time-limit"
                              name={field.name}
                              variant="outline"
                            >
                              <HugeIcons icon={StopWatchIcon} />
                              {field.state.value
                                ? formatDuration(
                                    { minutes: field.state.value / 60 },
                                    { locale: getLocale(locale) }
                                  )
                                : t("time-limit-placeholder")}
                              <HugeIcons
                                className="ml-auto"
                                icon={ArrowDown01Icon}
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="max-h-64 w-(--radix-dropdown-menu-trigger-width)"
                          >
                            {getTimeLimitList().map((time) => (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                key={time}
                                onSelect={() => field.handleChange(time)}
                              >
                                {formatDuration(
                                  { minutes: time / 60 },
                                  { locale: getLocale(locale) }
                                )}
                                <HugeIcons
                                  className={cn(
                                    "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                    field.state.value === time && "opacity-100"
                                  )}
                                  icon={Tick01Icon}
                                />
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Field>
                    );
                  }}
                </form.Field>
              </Activity>
            )}
          </form.Subscribe>
        </FieldGroup>
      </ResponsiveDialog>
    </form>
  );
}

export function getTimeLimitList(): number[] {
  const result: number[] = [];
  for (let i = 30; i <= 360; i += 15) {
    result.push(i * 60);
  }
  return result;
}
