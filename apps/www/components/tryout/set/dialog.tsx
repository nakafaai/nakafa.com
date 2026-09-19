"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import type { TryoutStartAccess } from "@repo/backend/convex/tryouts/start/spec";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";

interface TryoutStartDialogProps {
  readonly busy: boolean;
  readonly directEntry: boolean;
  readonly finishedAttempt: boolean;
  readonly kind: TryoutStartAccess["kind"];
  readonly onCancel: () => void;
  readonly onPrimary: () => void;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

/** Confirms the timer and retained history before starting a free try-out. */
export function TryoutStartDialog(props: TryoutStartDialogProps) {
  const t = useTranslations("Tryouts");
  const copy = getDialogCopy(props, t);

  return (
    <ResponsiveDialog
      description={copy.description}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={props.busy}
            onClick={props.onCancel}
            type="button"
            variant="outline"
          >
            {t("cancel-cta")}
          </Button>
          <Button disabled={props.busy} onClick={props.onPrimary} type="button">
            <Spinner
              data-icon="inline-start"
              icon={Rocket01Icon}
              isLoading={props.busy}
            />
            {copy.primary}
          </Button>
        </div>
      }
      open={props.open}
      setOpen={props.setOpen}
      title={copy.title}
    />
  );
}

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
        : t("free-dialog-description"),
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
      : t("start-dialog-description"),
    primary: t("start-cta"),
    title: t("start-dialog-title"),
  };
}
