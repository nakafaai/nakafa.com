"use client";

import {
  CheckmarkCircle02Icon,
  Diamond02Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import type { TryoutStartDialogKind } from "@/lib/tryout/access";

const paywallBenefitKeys = [
  "paywall-benefit-access",
  "paywall-benefit-feedback",
] as const;

interface TryoutStartDialogProps {
  readonly busy: boolean;
  readonly directEntry: boolean;
  readonly finishedAttempt: boolean;
  readonly kind: TryoutStartDialogKind;
  readonly onCancel: () => void;
  readonly onPrimary: () => void;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

/** Renders free, included, and upgrade try-out decisions responsively. */
export function TryoutStartDialog(props: TryoutStartDialogProps) {
  const t = useTranslations("Tryouts");
  const copy = getDialogCopy(props, t);
  const upgrade = props.kind === "upgrade-required";

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
              icon={upgrade ? Diamond02Icon : Rocket01Icon}
              isLoading={props.busy}
            />
            {copy.primary}
          </Button>
        </div>
      }
      open={props.open}
      setOpen={props.setOpen}
      title={copy.title}
    >
      {upgrade ? <PaywallBenefits /> : undefined}
    </ResponsiveDialog>
  );
}

/** Shows the two concrete try-out benefits unlocked by Nakafa Pro. */
function PaywallBenefits() {
  const t = useTranslations("Tryouts");

  return (
    <ul className="space-y-3 text-sm">
      {paywallBenefitKeys.map((key) => (
        <li className="flex items-start gap-3" key={key}>
          <HugeIcons
            className="mt-0.5 size-4 text-primary"
            icon={CheckmarkCircle02Icon}
          />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
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
  if (props.kind === "upgrade-required") {
    return {
      description: t("paywall-description"),
      primary: t("checkout-cta"),
      title: t("paywall-title"),
    };
  }

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
