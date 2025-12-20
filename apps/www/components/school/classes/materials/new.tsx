"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import {
  addDays,
  format,
  getHours,
  getMinutes,
  isToday,
  set,
  startOfDay,
} from "date-fns";
import {
  BookPlusIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  Clock2Icon,
  PlusIcon,
} from "lucide-react";
import type { Locale } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useState } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { useClass } from "@/lib/context/use-class";
import { getLocale } from "@/lib/utils/date";
import {
  getMaterialStatus,
  materialStatusList,
} from "../_data/material-status";

const materialStatus = z.union([
  z.literal("draft"),
  z.literal("published"),
  z.literal("scheduled"),
]);

const formSchema = z
  .object({
    name: z.string().check(z.minLength(1), z.trim()),
    description: z.string().check(z.minLength(1), z.trim()),
    status: materialStatus,
    scheduledAt: z.optional(z.number()),
  })
  .check(
    z.refine((data) => {
      if (data.status !== "scheduled") {
        return true;
      }
      if (!data.scheduledAt) {
        return false;
      }
      return data.scheduledAt > Date.now();
    })
  );

function formatDateTime(timestamp: number, locale: Locale) {
  return format(timestamp, "PP, HH:mm", { locale: getLocale(locale) });
}

function getTimeString(timestamp: number) {
  return format(timestamp, "HH:mm");
}

function updateTime(timestamp: number, timeString: string) {
  const [hours, minutes] = timeString.split(":").map(Number);
  const newTimestamp = set(timestamp, { hours, minutes, seconds: 0 }).getTime();
  // Prevent setting past times
  if (newTimestamp <= Date.now()) {
    return timestamp;
  }
  return newTimestamp;
}

function updateDate(timestamp: number | undefined, newDate: Date) {
  const hours = timestamp ? getHours(timestamp) : 8;
  const minutes = timestamp ? getMinutes(timestamp) : 0;
  const newTimestamp = set(newDate, { hours, minutes, seconds: 0 }).getTime();
  // If selecting today with past time, use current time + 1 hour
  if (newTimestamp <= Date.now()) {
    return set(newDate, {
      hours: getHours(new Date()) + 1,
      minutes: 0,
      seconds: 0,
    }).getTime();
  }
  return newTimestamp;
}

function getDefaultScheduledAt() {
  return set(addDays(new Date(), 1), {
    hours: 8,
    minutes: 0,
    seconds: 0,
  }).getTime();
}

function getMinTime(timestamp: number | undefined) {
  if (timestamp && isToday(timestamp)) {
    return format(new Date(), "HH:mm");
  }
}

const defaultValues: z.infer<typeof formSchema> = {
  name: "",
  description: "",
  status: "published",
  scheduledAt: getDefaultScheduledAt(),
};

export function SchoolClassesMaterialsNew() {
  const t = useTranslations("School.Classes");

  const locale = useLocale();
  const classId = useClass((c) => c.class._id);

  const [openDialog, setOpenDialog] = useState(false);

  const createMaterial = useMutation(
    api.classes.materials.mutations.createMaterialGroup
  );

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await createMaterial({
          ...value,
          classId,
          // Only send scheduledAt when status is "scheduled"
          scheduledAt:
            value.status === "scheduled" ? value.scheduledAt : undefined,
        });
        setOpenDialog(false);
        form.reset();
      } catch {
        toast.error(t("create-material-group-failed"));
      }
    },
  });

  return (
    <form
      id="school-classes-materials-new-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ButtonGroup>
        <Button onClick={() => setOpenDialog(true)}>
          <BookPlusIcon />
          {t("new-material")}
        </Button>

        <ResponsiveDialog
          description={t("new-material-description")}
          footer={
            <form.Subscribe
              selector={(state) => [state.isValid, state.isSubmitting]}
            >
              {([isValid, isSubmitting]) => (
                <Button
                  disabled={!isValid || isSubmitting}
                  form="school-classes-materials-new-form"
                  type="submit"
                >
                  {isSubmitting ? <SpinnerIcon /> : <PlusIcon />}
                  {t("create")}
                </Button>
              )}
            </form.Subscribe>
          }
          open={openDialog}
          setOpen={setOpenDialog}
          title={t("new-material-title")}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  Boolean(field.state.meta.isTouched) &&
                  Boolean(!field.state.meta.isValid);
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="school-classes-materials-new-name">
                      {t("material-name-label")}
                    </FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id="school-classes-materials-new-name"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("material-name-placeholder")}
                      value={field.state.value}
                    />
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="description">
              {(field) => {
                const isInvalid =
                  Boolean(field.state.meta.isTouched) &&
                  Boolean(!field.state.meta.isValid);
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="school-classes-materials-new-description">
                      {t("material-description-label")}
                    </FieldLabel>
                    <Textarea
                      aria-invalid={isInvalid}
                      className="min-h-24"
                      id="school-classes-materials-new-description"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("material-description-placeholder")}
                      value={field.state.value}
                    />
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="status">
              {(field) => {
                const isInvalid =
                  Boolean(field.state.meta.isTouched) &&
                  Boolean(!field.state.meta.isValid);

                const currentStatus = getMaterialStatus(field.state.value);
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="school-classes-materials-new-status">
                      {t("material-status-label")}
                    </FieldLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-invalid={isInvalid}
                          className="w-full font-normal"
                          id="school-classes-materials-new-status"
                          name={field.name}
                          variant="outline"
                        >
                          <currentStatus.icon />
                          {t(currentStatus.labelKey)}
                          <ChevronDownIcon className="ml-auto" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-(--radix-dropdown-menu-trigger-width)"
                      >
                        {materialStatusList.map((status) => (
                          <DropdownMenuItem
                            className="cursor-pointer"
                            key={status.value}
                            onSelect={() => field.handleChange(status.value)}
                          >
                            <status.icon />
                            {t(status.labelKey)}
                            <CheckIcon
                              className={cn(
                                "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                field.state.value === status.value &&
                                  "opacity-100"
                              )}
                            />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Field>
                );
              }}
            </form.Field>

            <form.Subscribe selector={(state) => [state.values.status]}>
              {([status]) => (
                <Activity mode={status === "scheduled" ? "visible" : "hidden"}>
                  <form.Field name="scheduledAt">
                    {(field) => {
                      const isInvalid =
                        Boolean(field.state.meta.isTouched) &&
                        Boolean(!field.state.meta.isValid);
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="school-classes-materials-new-scheduled-at">
                            {t("material-scheduled-at-label")}
                          </FieldLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                aria-invalid={isInvalid}
                                className="w-full font-normal"
                                id="school-classes-materials-new-scheduled-at"
                                name={field.name}
                                variant="outline"
                              >
                                <CalendarIcon />
                                {field.state.value
                                  ? formatDateTime(field.state.value, locale)
                                  : t("material-scheduled-at-placeholder")}
                                <ChevronDownIcon className="ml-auto" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-auto overflow-hidden p-0"
                            >
                              <Calendar
                                disabled={{ before: startOfDay(new Date()) }}
                                mode="single"
                                onSelect={(date) => {
                                  if (date) {
                                    field.handleChange(
                                      updateDate(field.state.value, date)
                                    );
                                  }
                                }}
                                selected={
                                  field.state.value
                                    ? new Date(field.state.value)
                                    : undefined
                                }
                              />
                              <div className="border-t p-3">
                                <div className="flex flex-col gap-2">
                                  <FieldLabel htmlFor="school-classes-materials-new-scheduled-time">
                                    {t("material-scheduled-time-label")}
                                  </FieldLabel>
                                  <div className="relative flex w-full items-center">
                                    <Clock2Icon className="pointer-events-none absolute left-3 size-4 select-none text-muted-foreground" />
                                    <Input
                                      className="appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                      id="school-classes-materials-new-scheduled-time"
                                      min={getMinTime(field.state.value)}
                                      onChange={(e) => {
                                        if (field.state.value) {
                                          field.handleChange(
                                            updateTime(
                                              field.state.value,
                                              e.target.value
                                            )
                                          );
                                        }
                                      }}
                                      type="time"
                                      value={
                                        field.state.value
                                          ? getTimeString(field.state.value)
                                          : ""
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </Field>
                      );
                    }}
                  </form.Field>
                </Activity>
              )}
            </form.Subscribe>
          </FieldGroup>
        </ResponsiveDialog>
      </ButtonGroup>
    </form>
  );
}
