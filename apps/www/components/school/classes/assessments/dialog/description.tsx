"use client";

import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useTranslations } from "next-intl";

interface AssessmentDescriptionFieldProps {
  formId: string;
  isInvalid: boolean;
  name: string;
  onBlur: () => void;
  onValueChange: (value: string) => void;
  value: string;
}

/** Renders the optional assessment description input. */
export function AssessmentDescriptionField({
  formId,
  isInvalid,
  name,
  onBlur,
  onValueChange,
  value,
}: AssessmentDescriptionFieldProps) {
  const t = useTranslations("School.Classes");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={`${formId}-description`}>
        {t("assessment-description-label")}
      </FieldLabel>
      <Textarea
        aria-invalid={isInvalid}
        className="min-h-24"
        id={`${formId}-description`}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={t("assessment-description-placeholder")}
        value={value}
      />
    </Field>
  );
}
