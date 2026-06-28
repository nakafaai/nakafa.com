"use client";

import { ArrowDown01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import {
  assessmentModeList,
  getAssessmentMode,
} from "@/components/school/classes/assessments/data/mode";

interface AssessmentModeFieldProps {
  formId: string;
  isInvalid: boolean;
  name: string;
  onValueChange: (value: (typeof assessmentModeList)[number]["value"]) => void;
  value: (typeof assessmentModeList)[number]["value"];
}

/** Renders the assessment mode picker. */
export function AssessmentModeField({
  formId,
  isInvalid,
  name,
  onValueChange,
  value,
}: AssessmentModeFieldProps) {
  const t = useTranslations("School.Classes");
  const currentMode = getAssessmentMode(value);

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={`${formId}-mode`}>
        {t("assessment-mode-label")}
      </FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-invalid={isInvalid}
              className="w-full font-normal"
              id={`${formId}-mode`}
              name={name}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={currentMode.icon} />
              {t(currentMode.labelKey)}
              <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-(--anchor-width)">
          {assessmentModeList.map((option) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={option.value}
              onClick={() => onValueChange(option.value)}
            >
              <HugeIcons icon={option.icon} />
              {t(option.labelKey)}
              <HugeIcons
                className={cn(
                  "ml-auto size-4 opacity-0 transition-opacity ease-out",
                  value === option.value && "opacity-100"
                )}
                icon={Tick01Icon}
              />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Field>
  );
}
