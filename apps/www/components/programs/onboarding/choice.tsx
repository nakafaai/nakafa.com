"use client";

import { useTranslations } from "next-intl";
import type {
  FocusOption,
  RoleOption,
} from "@/components/programs/onboarding/options";
import { ChoiceCardContent } from "@/components/shared/choice/card";
import {
  ChoiceCardIcon,
  ChoiceCardVisual,
} from "@/components/shared/choice/visual";

/** Renders one selectable role or focus card for onboarding. */
export function OnboardingChoice({
  option,
}: {
  option: FocusOption | RoleOption;
}) {
  const t = useTranslations("LearningPrograms");

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden">
      <ChoiceCardVisual seed={option.key}>
        <ChoiceCardIcon icon={option.icon} />
      </ChoiceCardVisual>
      <ChoiceCardContent>
        <div className="grid gap-2">
          <h2 className="font-medium">{t(option.titleKey)}</h2>
          <p className="text-muted-foreground text-sm">
            {t(option.descriptionKey)}
          </p>
        </div>
      </ChoiceCardContent>
    </div>
  );
}
