"use client";

import {
  ArrowDown01Icon,
  Calendar03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
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
import { getAcademicYearList } from "@/components/school/classes/header-add-utils";

interface HeaderAddYearFieldProps {
  isInvalid: boolean;
  name: string;
  onValueChange: (value: string) => void;
  value: string;
}

/** Renders the academic year picker for the school class create dialog. */
export function HeaderAddYearField({
  isInvalid,
  name,
  onValueChange,
  value,
}: HeaderAddYearFieldProps) {
  const t = useTranslations("School.Classes");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor="school-classes-header-add-year">
        {t("year-label")}
      </FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-invalid={isInvalid}
              className="w-full font-normal"
              id="school-classes-header-add-year"
              name={name}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={Calendar03Icon} />
              {value || t("year-placeholder")}
              <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-(--anchor-width)">
          {getAcademicYearList().map((year) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={year}
              onClick={() => onValueChange(year)}
            >
              {year}
              <HugeIcons
                className={cn(
                  "ml-auto size-4 opacity-0 transition-opacity ease-out",
                  value === year && "opacity-100"
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
