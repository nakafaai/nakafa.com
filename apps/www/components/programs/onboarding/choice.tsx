"use client";

import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { QuestionnaireChoiceDescription } from "@repo/design-system/components/ui/questionnaire";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type {
  focusOptions,
  regionOptions,
  roleOptions,
} from "@/components/programs/onboarding/options";
import { CountryFlagIcon } from "@/components/shared/country-flag";

type DisplayOption =
  | (typeof focusOptions)[number]
  | (typeof regionOptions)[number]
  | (typeof roleOptions)[number];

/** Renders one localized choice with the existing app icon and flag primitives. */
export function OnboardingOption({ option }: { option: DisplayOption }) {
  const t = useTranslations("LearningPrograms");
  const countryCode = "countryCode" in option ? option.countryCode : undefined;
  const icon = "icon" in option ? option.icon : undefined;
  const descriptionKey =
    "descriptionKey" in option ? option.descriptionKey : undefined;
  const description = descriptionKey ? t(descriptionKey) : undefined;
  const title = t(option.titleKey);

  return (
    <span
      className={cn(
        "flex min-w-0 gap-3",
        description ? "items-start" : "items-center"
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center",
          description && "mt-0.5"
        )}
      >
        {countryCode ? (
          <CountryFlagIcon className="size-4" countryCode={countryCode} />
        ) : null}
        {icon ? <HugeIcons className="size-4" icon={icon} /> : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1 overflow-hidden">
        <span className="truncate font-medium">{title}</span>
        {description ? (
          <QuestionnaireChoiceDescription
            className="truncate"
            title={description}
          >
            {description}
          </QuestionnaireChoiceDescription>
        ) : null}
      </span>
    </span>
  );
}
