import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
} from "@repo/design-system/components/ui/questionnaire";
import type { ComponentProps, ReactNode } from "react";
import {
  CountryFlagIcon,
  type RegionCountryCode,
} from "@/components/shared/flag";

/**
 * The choices of one question as one compact list: a single column of rows of the same height,
 * joined by dividers, so every choice reads in full at 390 px and a long question never scrolls
 * through a grid of uneven cards.
 */
export function StartChoices({ children }: { children: ReactNode }) {
  return (
    <QuestionnaireChoices className="gap-0 divide-y divide-input rounded-md border border-input shadow-xs">
      {children}
    </QuestionnaireChoices>
  );
}

/**
 * One row of a question's list. A phone has no keyboard, so the row keeps its letter shortcut for
 * wider screens only, and gives the room to the words.
 */
export function StartChoice(props: ComponentProps<typeof QuestionnaireChoice>) {
  return (
    <QuestionnaireChoice
      className="rounded-none border-0 shadow-none first:rounded-t-md last:rounded-b-md max-sm:[&>[data-slot=questionnaire-choice-shortcut]]:hidden"
      {...props}
    />
  );
}

/**
 * One choice of the school questionnaire: a flag or an icon when the choice has one, its title on
 * one line, and a short line under it when it has one. Nothing is cut off: each line is written to
 * fit a phone's row.
 */
export function StartOption({
  country,
  description,
  icon,
  title,
}: {
  country?: RegionCountryCode;
  description?: string;
  icon?: IconSvgElement;
  title: string;
}) {
  return (
    <span className="flex min-w-0 items-start gap-3">
      {country === undefined ? null : (
        <CountryFlagIcon
          className="mt-0.5 size-4 shrink-0"
          countryCode={country}
        />
      )}
      {icon === undefined ? null : (
        <HugeIcons className="mt-0.5 size-4 shrink-0" icon={icon} />
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{title}</span>
        {description === undefined ? null : (
          <QuestionnaireChoiceDescription>
            {description}
          </QuestionnaireChoiceDescription>
        )}
      </span>
    </span>
  );
}

/**
 * One school level on a single line: its short name in a column of its own, so the names line up,
 * and what it means beside it.
 */
export function StartLevelOption({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-3">
      <span className="w-16 shrink-0 font-medium">{title}</span>
      <QuestionnaireChoiceDescription>
        {description}
      </QuestionnaireChoiceDescription>
    </span>
  );
}
