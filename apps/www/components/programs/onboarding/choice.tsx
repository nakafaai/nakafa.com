"use client";

import type { IconSvgElement } from "@hugeicons/react";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import type {
  FocusOption,
  RoleOption,
} from "@/components/programs/onboarding/options";

/** Renders one normal-user role card for the first onboarding step. */
export function RoleChoice({ option }: { option: RoleOption }) {
  const t = useTranslations("LearningPrograms");

  return (
    <OnboardingChoice
      description={t(option.descriptionKey)}
      icon={option.icon}
      seed={option.key}
      title={t(option.titleKey)}
    />
  );
}

/** Renders one learner-facing focus card for the selected role. */
export function FocusChoice({ option }: { option: FocusOption }) {
  const t = useTranslations("LearningPrograms");

  return (
    <OnboardingChoice
      description={t(option.descriptionKey)}
      icon={option.icon}
      seed={option.key}
      title={t(option.titleKey)}
    />
  );
}

/** Renders the shared product-card anatomy used by both onboarding steps. */
function OnboardingChoice({
  description,
  icon,
  seed,
  title,
}: {
  description: string;
  icon: IconSvgElement;
  seed: string;
  title: string;
}) {
  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden">
      <ChoicePreview icon={icon} seed={seed} />
      <div className="space-y-2 px-6 pt-3 pb-6 text-center">
        <div className="grid gap-2">
          <h2 className="font-medium text-lg">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}

/** Renders the decorative onboarding preview art inside the established card anatomy. */
function ChoicePreview({ icon, seed }: { icon: IconSvgElement; seed: string }) {
  return (
    <div className="relative flex aspect-video w-full items-center justify-center">
      <GradientBlock
        className="mask-[linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] mask-no-repeat mask-size-[100%_100%] pointer-events-none absolute inset-0 opacity-20"
        colorScheme="vibrant"
        intensity="medium"
        keyString={seed}
      />
      <HugeIcons
        aria-hidden
        className="relative size-8 text-foreground/70"
        icon={icon}
      />
    </div>
  );
}
