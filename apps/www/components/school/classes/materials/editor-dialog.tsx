"use client";

import {
  ArrowDown01Icon,
  Calendar03Icon,
  Tick01Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import { Button } from "@repo/design-system/components/ui/button";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { startOfDay } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Activity } from "react";
import { toast } from "sonner";
import {
  getMaterialStatus,
  materialStatusList,
} from "@/components/school/classes/_data/material-status";
import {
  type MaterialGroupFormValues,
  materialGroupFormSchema,
} from "./schema";
import {
  formatScheduledAt,
  getMinTime,
  getTimeString,
  updateDate,
  updateTime,
} from "./utils";

interface MaterialGroupEditorDialogProps {
  defaultValues: MaterialGroupFormValues;
  description: string;
  errorContext: Record<string, string>;
  errorMessage: string;
  formId: string;
  onSubmit: (value: MaterialGroupFormValues) => Promise<void>;
  open: boolean;
  setOpen: (open: boolean) => void;
  submitLabel: string;
  title: string;
}

/**
 * Render the shared material-group editor dialog used by both create and edit
 * flows.
 */
export function MaterialGroupEditorDialog({
  defaultValues,
  description,
  errorContext,
  errorMessage,
  formId,
  onSubmit,
  open,
  setOpen,
  submitLabel,
  title,
}: MaterialGroupEditorDialogProps) {
  const t = useTranslations("School.Classes");
  const locale = useLocale();

  const form = useForm({
    defaultValues,
    validators: {
      onChange: materialGroupFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value);
        setOpen(false);
      } catch (error) {
        captureException(error, errorContext);
        toast.error(errorMessage);
      }
    },
  });

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <ResponsiveDialog
        description={description}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form={formId}
                type="submit"
              >
                <Spinner isLoading={isSubmitting} />
                {submitLabel}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpen}
        title={title}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={`${formId}-name`}>
                    {t("material-name-label")}
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={`${formId}-name`}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
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
                  <FieldLabel htmlFor={`${formId}-description`}>
                    {t("material-description-label")}
                  </FieldLabel>
                  <Textarea
                    aria-invalid={isInvalid}
                    className="min-h-24"
                    id={`${formId}-description`}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
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
                  <FieldLabel htmlFor={`${formId}-status`}>
                    {t("material-status-label")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-invalid={isInvalid}
                        className="w-full font-normal"
                        id={`${formId}-status`}
                        name={field.name}
                        variant="outline"
                      >
                        <HugeIcons icon={currentStatus.icon} />
                        {t(currentStatus.labelKey)}
                        <HugeIcons className="ml-auto" icon={ArrowDown01Icon} />
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
                          <HugeIcons icon={status.icon} />
                          {t(status.labelKey)}
                          <HugeIcons
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === status.value &&
                                "opacity-100"
                            )}
                            icon={Tick01Icon}
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
                        <FieldLabel htmlFor={`${formId}-scheduled-at`}>
                          {t("material-scheduled-at-label")}
                        </FieldLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              aria-invalid={isInvalid}
                              className="w-full font-normal"
                              id={`${formId}-scheduled-at`}
                              name={field.name}
                              variant="outline"
                            >
                              <HugeIcons icon={Calendar03Icon} />
                              {field.state.value
                                ? formatScheduledAt(field.state.value, locale)
                                : t("material-scheduled-at-placeholder")}
                              <HugeIcons
                                className="ml-auto"
                                icon={ArrowDown01Icon}
                              />
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
                                if (!date) {
                                  return;
                                }

                                field.handleChange(
                                  updateDate(field.state.value, date)
                                );
                              }}
                              selected={
                                field.state.value
                                  ? new Date(field.state.value)
                                  : undefined
                              }
                            />
                            <div className="border-t p-3">
                              <div className="flex flex-col gap-2">
                                <FieldLabel
                                  htmlFor={`${formId}-scheduled-time`}
                                >
                                  {t("material-scheduled-time-label")}
                                </FieldLabel>
                                <div className="relative flex w-full items-center">
                                  <HugeIcons
                                    className="pointer-events-none absolute left-3 size-4 select-none text-muted-foreground"
                                    icon={Time04Icon}
                                  />
                                  <Input
                                    className="cursor-text appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                    id={`${formId}-scheduled-time`}
                                    min={getMinTime(field.state.value)}
                                    onChange={(event) => {
                                      if (!field.state.value) {
                                        return;
                                      }

                                      field.handleChange(
                                        updateTime(
                                          field.state.value,
                                          event.target.value
                                        )
                                      );
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
    </form>
  );
}
