import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { QuestionnaireChoiceDescription } from "@repo/design-system/components/ui/questionnaire";
import {
  CountryFlagIcon,
  type RegionCountryCode,
} from "@/components/shared/flag";

/**
 * One choice of the school questionnaire: a flag or an icon when the choice has
 * one, its title, and a short line under it when it has one.
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
        <span className="truncate font-medium">{title}</span>
        {description === undefined ? null : (
          <QuestionnaireChoiceDescription className="text-pretty">
            {description}
          </QuestionnaireChoiceDescription>
        )}
      </span>
    </span>
  );
}
