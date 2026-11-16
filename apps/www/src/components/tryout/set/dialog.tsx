import {
  Rocket01Icon,
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
import { Duration } from "effect";
import { useTranslations } from "use-intl";

interface TryoutStartDialogProps {
  readonly directEntry: boolean;
  readonly finishedAttempt: boolean;
  readonly kind: TryoutStartAccess["kind"];
  readonly onPrimary: () => void;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

/**
 * Confirms the timer and retained history before starting a free try-out. Its primary closes it with the
 * press: the page shows what the start brings while the server answers.
 */
export function TryoutStartDialog(props: TryoutStartDialogProps) {
  const t = useTranslations("Tryouts");
  const copy = getDialogCopy(props, t);

  return (
    <ResponsiveDialog
      action={
        <Button onClick={props.onPrimary} type="button">
          <HugeIcons data-icon="inline-start" icon={Rocket01Icon} />
          {copy.primary}
        </Button>
      }
      description={copy.description}
      open={props.open}
      setOpen={props.setOpen}
      title={copy.title}
    >
      <div className="flex flex-col gap-2">
        <ResponsiveDialogSubject icon={Timer01Icon}>
          {t("start-timer")}
        </ResponsiveDialogSubject>
        <ResponsiveDialogSubject icon={WorkHistoryIcon}>
          {t("start-history")}
        </ResponsiveDialogSubject>
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
