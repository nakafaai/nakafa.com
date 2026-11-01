import { Alert02Icon } from "@hugeicons/core-free-icons";
import { questionGap } from "@repo/backend/confect/exams/parts";
import type { QuestionTemplate } from "@repo/backend/confect/exams/question";
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
import { statusIconVariants } from "@repo/design-system/lib/status";
import { Match, Option } from "effect";
import { useTranslations } from "use-intl";
import type { QuestionEditing } from "@/components/tenant/exams/edits";

/** The mark of a question with a part that shows nothing, in the words of its template. */
const emptyMark = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.whenOr("match", "table", () => "page-empty-part" as const),
    Match.orElse(() => "page-empty-choice" as const)
  );

/**
 * What keeps a question from being scheduled, as the schedule names it: an empty part, or no key.
 * The row above the page holds it on one line, so it is its icon alone until the row has room for
 * its words, and a press or a hover says what to do about it at every width.
 */
export function QuestionGapMark({
  question,
}: {
  question: QuestionEditing["displayed"];
}) {
  const t = useTranslations("Exams");

  return Option.match(questionGap(question), {
    onNone: () => null,
    onSome: (gap) => {
      const mark = t(
        gap === "empty" ? emptyMark(question.template) : "page-no-key"
      );
      return (
        <Popover>
          <PopoverTrigger
            openOnHover
            render={
              <Button
                aria-label={mark}
                className="text-muted-foreground shrink-0"
                size="sm"
                variant="ghost"
              />
            }
          >
            <HugeIcons
              aria-hidden="true"
              className={statusIconVariants({ tone: "warning" })}
              icon={Alert02Icon}
            />
            <span className="@max-3xl/row:sr-only">{mark}</span>
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverHeader>
              <PopoverTitle>{mark}</PopoverTitle>
              <PopoverDescription>
                {t(gap === "empty" ? "page-gap-empty" : "page-gap-key")}
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      );
    },
  });
}
