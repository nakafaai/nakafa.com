import { Card } from "@repo/design-system/components/ui/card";
import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

/**
 * The page of one question, as the canvas draws it and the strip draws it small: its
 * number, then what the page holds. One component draws both, so a thumbnail looks like
 * its canvas.
 */
export function QuestionSheet({
  children,
  number,
}: {
  children: ReactNode;
  number: number;
}) {
  const t = useTranslations("Exams");

  return (
    <Card className="@container mx-auto w-full max-w-3xl gap-4 p-8">
      <h2 className="font-semibold text-lg">{t("question", { number })}</h2>
      {children}
    </Card>
  );
}

/** The place of the prompt on a question's page. */
export function QuestionSheetPrompt({ children }: { children: ReactNode }) {
  return <section className="my-6">{children}</section>;
}

/**
 * The options of a question's page, one column on a narrow page and two on a wide one. The
 * page's own width decides, so a thumbnail lays them out as its canvas does.
 */
export function QuestionSheetOptions(props: ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup {...props} className="grid @lg:grid-cols-2 grid-cols-1 gap-2" />
  );
}

/**
 * One option on a question's page: the radio that marks it correct, in a dashed outline,
 * its letter, and its text field as the children.
 */
export function QuestionSheetOption({
  children,
  letter,
  radio,
}: {
  children: ReactNode;
  letter: string;
  radio: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-primary border-dashed">
        {radio}
      </span>
      <span aria-hidden className="w-5 shrink-0 font-medium">
        {letter}
      </span>
      {children}
    </div>
  );
}
