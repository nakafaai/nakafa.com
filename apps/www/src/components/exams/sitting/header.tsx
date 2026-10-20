import type { GenericId } from "@confect/core";
import { CancelCircleIcon, Key01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@repo/internationalization/src/navigation";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  useMayProctor,
  useSittingData,
} from "@/components/exams/sitting/context";
import {
  ChangeTokenDialog,
  CloseSittingDialog,
} from "@/components/exams/sitting/dialogs";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";

/**
 * The one header of the dashboard: the sidebar's trigger, the path from the exams through the
 * exam, whose link returns to the exam's rooms, to the sitting's room, and at its end the token
 * with the action that changes it, then the action that closes the sitting. The exams crumb is
 * left out for a viewer who may not open the exam list. The page carries the token only for a
 * proctor, and the actions show only when the page lists them. On a phone each action shows its
 * icon alone, named for assistive technology, so the header stays one row beside the folded path.
 */
export function SittingHeader({
  examId,
}: {
  readonly examId: GenericId.GenericId<"exams">;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const { value } = useSittingData();
  const mayProctor = useMayProctor();
  const [dialog, setDialog] = useState<"close" | "token" | null>(null);

  return (
    <SchoolHeader
      items={[
        ...(tenant.canOpenExams ? [{ href: "/exams", label: t("title") }] : []),
        { href: `/exams/${examId}`, label: value.sitting.examTitle },
        { label: value.sitting.room },
      ]}
      title={value.sitting.room}
    >
      {value.token === null ? null : (
        <span className="font-mono text-sm tabular-nums tracking-wider">
          {value.token}
        </span>
      )}
      {value.sitting.state === "closed" && value.canViewResults ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/exams/${examId}/sittings/${value.sitting.id}/results`}
        >
          {t("results-title")}
        </Link>
      ) : null}
      {mayProctor ? (
        <>
          <Button
            onClick={() => setDialog("token")}
            type="button"
            variant="outline"
          >
            <HugeIcons icon={Key01Icon} />
            <span className="max-sm:sr-only">{t("change-token")}</span>
          </Button>
          <Button
            onClick={() => setDialog("close")}
            type="button"
            variant="destructive"
          >
            <HugeIcons icon={CancelCircleIcon} />
            <span className="max-sm:sr-only">{t("close-sitting")}</span>
          </Button>
        </>
      ) : null}
      <ChangeTokenDialog
        onOpenChange={(open) => setDialog(open ? "token" : null)}
        open={dialog === "token"}
      />
      <CloseSittingDialog
        onOpenChange={(open) => setDialog(open ? "close" : null)}
        open={dialog === "close"}
      />
    </SchoolHeader>
  );
}
