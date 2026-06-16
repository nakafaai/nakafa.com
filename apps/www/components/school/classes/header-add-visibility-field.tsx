"use client";

import {
  ArrowDown01Icon,
  Tick01Icon,
  ViewIcon,
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
import { classVisibilityList } from "@/components/school/classes/header-add-schema";

interface HeaderAddVisibilityFieldProps {
  isInvalid: boolean;
  name: string;
  onValueChange: (value: (typeof classVisibilityList)[number]) => void;
  value: (typeof classVisibilityList)[number];
}

/** Renders the class visibility picker for the school class create dialog. */
export function HeaderAddVisibilityField({
  isInvalid,
  name,
  onValueChange,
  value,
}: HeaderAddVisibilityFieldProps) {
  const t = useTranslations("School.Classes");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor="school-classes-header-add-visibility">
        {t("visibility-label")}
      </FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-invalid={isInvalid}
              className="w-full font-normal"
              id="school-classes-header-add-visibility"
              name={name}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={ViewIcon} />
              {t(value)}
              <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-(--anchor-width)">
          {classVisibilityList.map((visibility) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={visibility}
              onClick={() => onValueChange(visibility)}
            >
              {t(visibility)}
              <HugeIcons
                className={cn(
                  "ml-auto size-4 opacity-0 transition-opacity ease-out",
                  value === visibility && "opacity-100"
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
