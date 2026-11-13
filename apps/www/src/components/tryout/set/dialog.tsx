import {
  CheckmarkCircle02Icon,
  Rocket01Icon,
  Target02Icon,
  Timer01Icon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";
import type { TryoutStartAccess } from "@repo/backend/confect/tryouts/start/spec";
import { TRYOUT_ATTEMPT_WINDOW } from "@repo/backend/confect/tryouts/window";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Duration, Option, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { getTryoutPracticeTarget } from "@/components/tryout/route/path";
import { TargetLink } from "@/lib/routing/link";

/** How a learner takes the set: a practice with no clock, or the timed simulation of the real exam. */
const StartMode = Schema.Literals(["practice", "simulation"]);

interface TryoutStartDialogProps {
  readonly directEntry: boolean;
  readonly finishedAttempt: boolean;
  readonly kind: TryoutStartAccess["kind"];
  readonly onPrimary: () => void;
  readonly open: boolean;
  /** The page the start was pressed on, whose practice the dialog's practice opens. */
  readonly pagePath: string;
  readonly setOpen: (open: boolean) => void;
}

/**
 * Asks how the learner takes the set before it starts: the timed simulation, which confirms the timer and the
 * kept history and starts the attempt, or the practice, which opens the page's practice with no clock. Its
 * primary closes it with the press: the page shows what the start brings while the server answers.
 */
export function TryoutStartDialog(props: TryoutStartDialogProps) {
  const t = useTranslations("Tryouts");
  const [mode, setMode] = useState<typeof StartMode.Type>("simulation");
  const copy = getDialogCopy(props, t);
  const practice = getTryoutPracticeTarget(props.pagePath);
  const practicing = Option.filter(practice, () => mode === "practice");

  return (
    <ResponsiveDialog
      action={Option.match(practicing, {
        onNone: () => (
          <Button onClick={props.onPrimary} type="button">
            <HugeIcons data-icon="inline-start" icon={Rocket01Icon} />
            {copy.primary}
          </Button>
        ),
        onSome: (target) => (
          <TargetLink
            className={buttonVariants()}
            onClick={() => props.setOpen(false)}
            target={target}
          >
            <HugeIcons data-icon="inline-start" icon={Target02Icon} />
            {t("practice-start-cta")}
          </TargetLink>
        ),
      })}
      description={
        Option.isSome(practicing)
          ? t("practice-dialog-description")
          : copy.description
      }
      open={props.open}
      setOpen={props.setOpen}
      title={copy.title}
    >
      <div className="flex flex-col gap-4">
        {Option.isSome(practice) ? (
          <ToggleGroup
            aria-label={t("start-mode-label")}
            className="w-full"
            onValueChange={(next) => {
              if (Schema.is(StartMode)(next)) {
                setMode(next);
              }
            }}
            value={mode}
          >
            <ToggleGroupItem value="practice">
              <HugeIcons icon={Target02Icon} />
              {t("practice-cta")}
            </ToggleGroupItem>
            <ToggleGroupItem value="simulation">
              <HugeIcons icon={Timer01Icon} />
              {t("simulation-cta")}
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        {Option.isSome(practicing) ? (
          <div className="flex flex-col gap-2">
            <ResponsiveDialogSubject icon={Target02Icon}>
              {t("practice-no-timer")}
            </ResponsiveDialogSubject>
            <ResponsiveDialogSubject icon={CheckmarkCircle02Icon}>
              {t("practice-check-each")}
            </ResponsiveDialogSubject>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ResponsiveDialogSubject icon={Timer01Icon}>
              {t("start-timer")}
            </ResponsiveDialogSubject>
            <ResponsiveDialogSubject icon={WorkHistoryIcon}>
              {t("start-history")}
            </ResponsiveDialogSubject>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}

/** The hours an attempt stays open, which the dialog's words name. */
const WINDOW_HOURS = { hours: Duration.toHours(TRYOUT_ATTEMPT_WINDOW) };

/** Selects localized dialog copy from the resolved access decision. */
function getDialogCopy(
  props: Pick<
    TryoutStartDialogProps,
    "directEntry" | "finishedAttempt" | "kind"
  >,
  t: ReturnType<typeof useTranslations<"Tryouts">>
) {
  if (props.kind === "free-attempt") {
    return {
      description: props.directEntry
        ? t("free-entry-dialog-description")
        : t("free-dialog-description", WINDOW_HOURS),
      primary: t("free-cta"),
      title: t("free-dialog-title"),
    };
  }

  if (props.finishedAttempt) {
    return {
      description: props.directEntry
        ? t("restart-entry-dialog-description")
        : t("restart-dialog-description"),
      primary: t("restart-cta"),
      title: t("restart-dialog-title"),
    };
  }

  return {
    description: props.directEntry
      ? t("start-entry-dialog-description")
      : t("start-dialog-description", WINDOW_HOURS),
    primary: t("start-cta"),
    title: t("start-dialog-title"),
  };
}
