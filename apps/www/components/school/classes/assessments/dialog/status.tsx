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
  assessmentStatusList,
  getAssessmentStatus,
} from "@/components/school/classes/assessments/data/status";

interface AssessmentStatusFieldProps {
  formId: string;
  isInvalid: boolean;
  name: string;
  onValueChange: (
    value: (typeof assessmentStatusList)[number]["value"]
  ) => void;
  value: (typeof assessmentStatusList)[number]["value"];
}

/** Renders the assessment status picker. */
export function AssessmentStatusField({
  formId,
  isInvalid,
  name,
  onValueChange,
  value,
}: AssessmentStatusFieldProps) {
  const t = useTranslations("School.Classes");
  const currentStatus = getAssessmentStatus(value);

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={`${formId}-status`}>
        {t("assessment-status-label")}
      </FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-invalid={isInvalid}
              className="w-full font-normal"
              id={`${formId}-status`}
              name={name}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={currentStatus.icon} />
              {t(currentStatus.labelKey)}
              <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-(--anchor-width)">
          {assessmentStatusList.map((option) => (
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
