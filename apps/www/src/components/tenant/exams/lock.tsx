import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useTranslations } from "use-intl";
import { useDuplicateExam } from "@/components/tenant/exams/duplicate";
import { isFrozen } from "@/components/tenant/exams/freeze";
import { useExam } from "@/components/tenant/exams/provider";

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
  const { isPending, press } = useDuplicateExam(exam, slug);

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
