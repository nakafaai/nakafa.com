import type { LearningInterest } from "@repo/contents/_types/program/schema";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ToggleGroup } from "@repo/design-system/components/ui/toggle-group";
import type { useTranslations } from "next-intl";
import { InterestChoice, ProgramChoice, ProgramPreview } from "./choice";
import type { ProgramOption } from "./model";

type Translator = ReturnType<typeof useTranslations>;

/** Presents learner interest choices as a focused first onboarding step. */
export function InterestsStep({
  interestValues,
  onChange,
  t,
  value,
}: {
  interestValues: readonly LearningInterest[];
  onChange: (value: string[]) => void;
  t: Translator;
  value: readonly LearningInterest[];
}) {
  return (
    <Field className="gap-8">
      <StepHeading
        helper={t("onboarding.goal-helper")}
        title={t("onboarding.goal-title")}
      />
      <ToggleGroup
        aria-label={t("onboarding.goal-title")}
        className="gap-6 overflow-visible rounded-none bg-transparent shadow-none sm:grid-cols-2 lg:grid-cols-3"
        gridColumns="auto"
        onValueChange={onChange}
        type="multiple"
        value={value}
      >
        {interestValues.map((interest) => (
          <InterestChoice interest={interest} key={interest} t={t} />
        ))}
      </ToggleGroup>
    </Field>
  );
}

/** Presents learner-facing program choices for the selected goal. */
export function ProgramStep({
  onChange,
  programs,
  t,
  value,
}: {
  onChange: (value: string) => void;
  programs: readonly ProgramOption[];
  t: Translator;
  value: string;
}) {
  return (
    <Field className="gap-8">
      <StepHeading
        helper={t("onboarding.program-helper")}
        title={t("onboarding.program-title")}
      />

      {programs.length > 0 ? (
        <ToggleGroup
          aria-label={t("onboarding.program-title")}
          className="gap-6 overflow-visible rounded-none bg-transparent shadow-none sm:grid-cols-2 lg:grid-cols-3"
          gridColumns="auto"
          onValueChange={onChange}
          value={value}
        >
          {programs.map((program) => (
            <ProgramChoice key={program.key} program={program} />
          ))}
        </ToggleGroup>
      ) : (
        <Empty className="mx-auto w-full max-w-md border">
          <EmptyHeader>
            <EmptyTitle>{t("onboarding.unavailable-title")}</EmptyTitle>
            <EmptyDescription>
              {t("onboarding.unavailable-helper")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </Field>
  );
}

/** Shows the small final confirmation before the profile is saved. */
export function ConfirmStep({
  interests,
  program,
  t,
}: {
  interests: readonly LearningInterest[];
  program: ProgramOption | null;
  t: Translator;
}) {
  const interestLabels = interests.map((interest) => ({
    key: interest,
    title: t(`interest.${interest}.title`),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Field className="gap-3">
        <FieldLabel className="text-3xl sm:text-4xl">
          {t("onboarding.confirm-title")}
        </FieldLabel>
        <FieldDescription className="max-w-xl text-base">
          {t("onboarding.confirm-helper")}
        </FieldDescription>
      </Field>

      <div className="grid gap-8 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] sm:items-center">
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {t("onboarding.summary-interests")}
          </p>
          <div className="flex flex-wrap gap-2">
            {interestLabels.map((interest) => (
              <Badge
                className="rounded-full px-3 py-1 text-sm"
                key={interest.key}
                variant="secondary-subtle"
              >
                {interest.title}
              </Badge>
            ))}
          </div>
        </div>
        {program ? (
          <ProgramPreview
            label={t("onboarding.summary-path")}
            program={program}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Blocks onboarding when the current language has no learner-ready programs. */
export function UnavailableCatalogStep({ t }: { t: Translator }) {
  return (
    <Empty className="mx-auto w-full max-w-md border">
      <EmptyHeader>
        <EmptyTitle>{t("onboarding.unavailable-catalog-title")}</EmptyTitle>
        <EmptyDescription>
          {t("onboarding.unavailable-catalog-helper")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          className="h-11"
          nativeButton={false}
          render={
            <NavigationLink href="/home">
              {t("onboarding.unavailable-catalog-cta")}
            </NavigationLink>
          }
        />
      </EmptyContent>
    </Empty>
  );
}

/** Keeps each onboarding step to one title and one short helper line. */
function StepHeading({ helper, title }: { helper: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <FieldLabel className="text-3xl sm:text-4xl">{title}</FieldLabel>
      <FieldDescription className="max-w-xl text-base">
        {helper}
      </FieldDescription>
    </div>
  );
}
