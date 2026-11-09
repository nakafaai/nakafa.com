import { useMutation } from "@confect/react";
import { Flag02Icon } from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { ReportReason } from "@repo/backend/confect/comments/report";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Label } from "@repo/design-system/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@repo/design-system/components/ui/radio-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Schema } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useCommentDialog } from "@/components/comments/dialog";
import { useRowComment } from "@/components/comments/scope";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Asks why the learner reports another learner's comment, one reason of four, and sends the report. The
 * question closes at once and says the report is in; a refusal says so instead. A second report of the same
 * comment changes nothing on the server.
 */
export function CommentReport() {
  const { onOpenChange, open } = useCommentDialog("report");
  const comment = useRowComment();
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const id = useId();
  const [reason, setReason] = useState<typeof ReportReason.Type>("spam");
  const report = useMutation(comments.mutations.reportComment);

  /** Closes the question and sends the report. */
  function confirm() {
    onOpenChange(false);
    toast.success({ title: "comment-reported.title" });
    Effect.runPromise(
      Effect.tryPromise(() => report({ commentId: comment._id, reason })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/comments/report",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  });
                })
              )
            ),
        })
      )
    );
  }

  return (
    <ResponsiveDialog
      action={
        <Button onClick={confirm} type="button">
          <HugeIcons icon={Flag02Icon} />
          {tCommon("report")}
        </Button>
      }
      description={t("report-description")}
      open={open}
      setOpen={onOpenChange}
      title={t("report-title")}
    >
      <RadioGroup
        aria-label={t("report-title")}
        onValueChange={(value) => {
          if (Schema.is(ReportReason)(value)) {
            setReason(value);
          }
        }}
        value={reason}
      >
        {Arr.map(ReportReason.literals, (option) => (
          <div className="flex items-center gap-3" key={option}>
            <RadioGroupItem id={`${id}-${option}`} value={option} />
            <Label htmlFor={`${id}-${option}`}>{t(`reason-${option}`)}</Label>
          </div>
        ))}
      </RadioGroup>
    </ResponsiveDialog>
  );
}
