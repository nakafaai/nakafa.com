import { useMutation } from "@confect/react";
import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { ExamTitle } from "@repo/backend/confect/exams/exam";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Fn, Schema, String as Str } from "effect";
import { use, useTransition } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { CreatedExamsContext } from "@/components/tenant/exams/created";
import { isFrozen } from "@/components/tenant/exams/freeze";
import { useExam } from "@/components/tenant/exams/provider";

/** The title of a duplicate, cut so it stays a title when the original fills the field. */
const duplicateTitle = (title: string, words: string) => {
  const titled = Str.trim(`${title} ${words}`);
  return Schema.is(ExamTitle)(titled) ? titled : Str.trim(title);
};

/**
 * Says that the exam takes no more changes, beside its actions in the header: why, and what the teacher can do
 * about it. An exam a finished sitting froze offers a copy to edit. An exam of an archived unit waits for the unit,
 * and the unit's settings restore it.
 */
export function ExamLockMark() {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isFrozen(exam);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={<Button aria-label={t("locked")} variant="outline" />}
      >
        <HugeIcons aria-hidden="true" icon={SquareLock01Icon} />
        <span className="max-sm:sr-only">{t("locked")}</span>
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>{t("locked-title")}</PopoverTitle>
          <PopoverDescription>
            {t(frozen ? "locked-frozen" : "archived-note")}
          </PopoverDescription>
        </PopoverHeader>
        {frozen ? <DuplicateExam /> : null}
      </PopoverContent>
    </Popover>
  );
}

/** Copies the exam, and opens the copy, which takes changes however the exam it came from is locked. */
function DuplicateExam() {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const created = use(CreatedExamsContext);
  const navigate = useNavigate();
  const duplicate = useMutation(exams.exams.duplicate);
  const [isPending, startTransition] = useTransition();

  const press = () =>
    startTransition(() =>
      runExamAction(
        sentAction(() =>
          duplicate({
            examId: exam.id,
            slug,
            title: duplicateTitle(exam.title, t("duplicate-suffix")),
          })
        ).pipe(
          Effect.tap((saved) =>
            Effect.sync(() => {
              // The editor draws the copy at once, as it draws a new exam, and its own read takes over.
              created?.getState().hold(saved);
              navigate({
                params: { exam: saved.id, slug },
                to: "/school/$slug/exams/$exam/edit",
              });
            })
          )
        ),
        { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
      )
    );

  return (
    <Button
      className="mt-3 w-full"
      disabled={isPending}
      onClick={press}
      type="button"
    >
      {t("duplicate-action")}
    </Button>
  );
}
