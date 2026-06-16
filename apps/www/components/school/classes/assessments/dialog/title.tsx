"use client";

import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { useTranslations } from "next-intl";

interface AssessmentTitleFieldProps {
  formId: string;
  isInvalid: boolean;
  name: string;
  onBlur: () => void;
  onValueChange: (value: string) => void;
  value: string;
}

/** Renders the required assessment title input. */
export function AssessmentTitleField({
  formId,
  isInvalid,
  name,
  onBlur,
  onValueChange,
  value,
}: AssessmentTitleFieldProps) {
  const t = useTranslations("School.Classes");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={`${formId}-title`}>
        {t("assessment-title-label")}
      </FieldLabel>
      <Input
        aria-invalid={isInvalid}
        id={`${formId}-title`}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={t("assessment-title-placeholder")}
        value={value}
      />
    </Field>
  );
}
