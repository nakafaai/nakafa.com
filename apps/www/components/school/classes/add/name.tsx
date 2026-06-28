"use client";

import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { useTranslations } from "next-intl";

interface HeaderAddNameFieldProps {
  isInvalid: boolean;
  name: string;
  onBlur: () => void;
  onValueChange: (value: string) => void;
  value: string;
}

/** Renders the name input for the school class create dialog. */
export function HeaderAddNameField({
  isInvalid,
  name,
  onBlur,
  onValueChange,
  value,
}: HeaderAddNameFieldProps) {
  const t = useTranslations("School.Classes");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor="school-classes-header-add-name">
        {t("name-label")}
      </FieldLabel>
      <Input
        aria-invalid={isInvalid}
        id="school-classes-header-add-name"
        name={name}
        onBlur={onBlur}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={t("name-placeholder")}
        value={value}
      />
    </Field>
  );
}
