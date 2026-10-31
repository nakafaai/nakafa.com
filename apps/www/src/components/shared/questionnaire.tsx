import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  QuestionnaireActions,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
} from "@repo/design-system/components/ui/questionnaire";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "use-intl";

/**
 * The row every Nakafa questionnaire ends with: back, continue, and the finish
 * action, whose icon and label (`children`) name what finishing does. While the
 * answers are sent the row holds still (`inert`) and the finish action's icon turns
 * into the loader, and the page moves on as soon as the server answers.
 */
export function QuestionnaireSteps({
  children,
  finishIcon,
  inert,
}: {
  children: ReactNode;
  finishIcon: ComponentProps<typeof HugeIcons>["icon"];
  inert: boolean;
}) {
  const t = useTranslations("Common");

  return (
    <QuestionnaireActions>
      <QuestionnairePrevious inert={inert} variant="ghost">
        <HugeIcons data-icon="inline-start" icon={ArrowLeft02Icon} />
        {t("back")}
      </QuestionnairePrevious>
      <QuestionnaireNext inert={inert}>
        {t("continue")}
        <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
      </QuestionnaireNext>
      <QuestionnaireSubmit inert={inert}>
        <Spinner data-icon="inline-start" icon={finishIcon} isLoading={inert} />
        {children}
      </QuestionnaireSubmit>
    </QuestionnaireActions>
  );
}
