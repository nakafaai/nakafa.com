"use client";

import {
  ArrowDown01Icon,
  Calendar03Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import {
  formatScheduledAt,
  getMinTime,
  getTimeString,
  updateDate,
  updateTime,
} from "@/components/school/classes/schedule";

interface AssessmentScheduledAtFieldProps {
  formId: string;
  isInvalid: boolean;
  locale: Locale;
  minimumDate: Date;
  name: string;
  onValueChange: (value: number | undefined) => void;
  value: number | undefined;
}

/** Renders the scheduled publication date and time picker. */
export function AssessmentScheduledAtField({
  formId,
  isInvalid,
  locale,
  minimumDate,
  name,
  onValueChange,
  value,
}: AssessmentScheduledAtFieldProps) {
  const t = useTranslations("School.Classes");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={`${formId}-scheduled-at`}>
        {t("assessment-scheduled-at-label")}
      </FieldLabel>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-invalid={isInvalid}
              className="w-full font-normal"
              id={`${formId}-scheduled-at`}
              name={name}
              type="button"
              variant="outline"
            />
          }
        >
          <HugeIcons icon={Calendar03Icon} />
          {value
            ? formatScheduledAt(value, locale)
            : t("assessment-scheduled-at-placeholder")}
          <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <Calendar
            disabled={{ before: minimumDate }}
            mode="single"
            onSelect={(date) => {
              if (!date) {
                return;
              }

              onValueChange(updateDate(value, date));
            }}
            selected={value ? new Date(value) : undefined}
          />
          <div className="border-t p-3">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor={`${formId}-scheduled-time`}>
                {t("assessment-scheduled-time-label")}
              </FieldLabel>
              <div className="relative flex w-full items-center">
                <HugeIcons
                  className="pointer-events-none absolute left-3 size-4 select-none text-muted-foreground"
                  icon={Time04Icon}
                />
                <Input
                  className="cursor-text appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  id={`${formId}-scheduled-time`}
                  min={getMinTime(value)}
                  onChange={(event) => {
                    if (!value) {
                      return;
                    }

                    onValueChange(updateTime(value, event.target.value));
                  }}
                  type="time"
                  value={value ? getTimeString(value) : ""}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
