"use client";

import { ImageDithering } from "@paper-design/shaders-react";
import { cn } from "@repo/design-system/lib/utils";
import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";
import type {
  FocusOption,
  RoleOption,
} from "@/components/programs/onboarding/options";

const previewToneVariants = cva(
  "relative aspect-video w-full overflow-hidden rounded-md bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))]",
  {
    variants: {
      tone: {
        guide: "bg-chart-3/15",
        nina: "bg-chart-1/10",
        practice: "bg-chart-5/10",
        school: "bg-chart-2/10",
        target: "bg-chart-4/10",
      },
    },
  }
);

/** Renders one normal-user role card for the first onboarding step. */
export function RoleChoice({ option }: { option: RoleOption }) {
  const t = useTranslations("LearningPrograms");

  return (
    <OnboardingChoice
      description={t(option.descriptionKey)}
      image={option.image}
      title={t(option.titleKey)}
      tone={option.tone}
    />
  );
}

/** Renders one learner-facing focus card for the selected role. */
export function FocusChoice({ option }: { option: FocusOption }) {
  const t = useTranslations("LearningPrograms");

  return (
    <OnboardingChoice
      description={t(option.descriptionKey)}
      image={option.image}
      title={t(option.titleKey)}
      tone={option.tone}
    />
  );
}

/** Renders the shared product-card anatomy used by both onboarding steps. */
function OnboardingChoice({
  description,
  image,
  title,
  tone,
}: {
  description: string;
  image: RoleOption["image"] | FocusOption["image"];
  title: string;
  tone: RoleOption["tone"] | FocusOption["tone"];
}) {
  return (
    <div
      className="flex h-full w-full flex-col justify-between"
      data-onboarding-card=""
    >
      <div className="p-2">
        <ChoicePreview image={image} tone={tone} />
      </div>
      <div className="px-6 pt-3 pb-6">
        <div className="grid gap-2">
          <h2 className="font-medium text-lg">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}

/** Applies Paper's image dithering treatment to deterministic preview sources. */
function ChoicePreview({
  image,
  tone,
}: {
  image: RoleOption["image"] | FocusOption["image"];
  tone: RoleOption["tone"] | FocusOption["tone"];
}) {
  return (
    <div
      className={cn(previewToneVariants({ tone }))}
      data-onboarding-preview=""
    >
      <ImageDithering
        aria-hidden
        className="absolute inset-0 size-full"
        colorSteps={3}
        fit="contain"
        height="100%"
        image={`/onboarding/${image}.png`}
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
