"use client";

import { ImageDithering } from "@paper-design/shaders-react";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type {
  FocusOption,
  RoleOption,
} from "@/components/programs/onboarding/options";

/** Renders one normal-user role card for the first onboarding step. */
export function RoleChoice({ option }: { option: RoleOption }) {
  const t = useTranslations("LearningPrograms");

  return <OnboardingChoice image={option.image} title={t(option.titleKey)} />;
}

/** Renders one learner-facing focus card for the selected role. */
export function FocusChoice({ option }: { option: FocusOption }) {
  const t = useTranslations("LearningPrograms");

  return <OnboardingChoice image={option.image} title={t(option.titleKey)} />;
}

/** Renders the shared product-card anatomy used by both onboarding steps. */
function OnboardingChoice({
  image,
  title,
}: {
  image: RoleOption["image"] | FocusOption["image"];
  title: string;
}) {
  return (
    <div className="flex h-full w-full flex-col justify-between">
      <div className="p-2">
        <ChoicePreview image={image} />
      </div>
      <div className="space-y-6 px-6 pt-3 pb-6">
        <div className="grid gap-2">
          <h2 className="font-medium text-lg">{title}</h2>
        </div>
      </div>
    </div>
  );
}

/** Applies Paper's image dithering treatment to deterministic preview sources. */
function ChoicePreview({
  image,
}: {
  image: RoleOption["image"] | FocusOption["image"];
}) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-md",
        "bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))]"
      )}
    >
      <ImageDithering
        aria-hidden
        className="absolute inset-0 size-full"
        colorSteps={3}
        fit="contain"
        height="100%"
        image={image}
        minPixelRatio={1}
        originalColors
        size={3}
        speed={0}
        type="4x4"
        width="100%"
      />
    </div>
  );
}
