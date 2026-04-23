"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  Edit01Icon,
  Tick01Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
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
import { useMutation } from "convex/react";
import { startOfDay } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Activity } from "react";
import { toast } from "sonner";
import {
  assessmentModeList,
  getAssessmentMode,
} from "@/components/school/classes/assessments/_data/mode";
import {
  assessmentStatusList,
  getAssessmentStatus,
} from "@/components/school/classes/assessments/_data/status";
import {
  type CreateAssessmentFormValues,
  createAssessmentFormSchema,
} from "@/components/school/classes/assessments/schema";
import type { Assessment } from "@/components/school/classes/assessments/types";
import {
  formatScheduledAt,
  getDefaultScheduledAt,
  getMinTime,
  getTimeString,
  updateDate,
  updateTime,
} from "@/components/school/classes/assessments/utils";
import { useClass } from "@/lib/context/use-class";

interface AssessmentDialogShellProps {
  defaultValues: CreateAssessmentFormValues;
  description: string;
  errorMessage: string;
  formId: string;
  onSubmit: (value: CreateAssessmentFormValues) => Promise<void>;
  open: boolean;
  setOpenAction: (open: boolean) => void;
  submitIcon: React.ComponentProps<typeof HugeIcons>["icon"];
  submitLabel: string;
  title: string;
}

/** Render the assessment create dialog for the active class. */
export function CreateAssessmentDialog({
  initialAssessment,
  open,
  setOpenAction,
}: {
  initialAssessment?: Assessment;
  open: boolean;
  setOpenAction: (open: boolean) => void;
}) {
  const t = useTranslations("School.Classes");
  const schoolId = useClass((state) => state.class.schoolId);
  const classId = useClass((state) => state.class._id);
  const createAssessment = useMutation(
    api.assessments.mutations.public.create.createAssessment
  );
  const updateAssessment = useMutation(
    api.assessments.mutations.public.update.updateAssessment
  );

  if (initialAssessment) {
    return (
      <AssessmentDialogShell
        defaultValues={{
          title: initialAssessment.title,
          description: initialAssessment.description?.text ?? "",
          mode: initialAssessment.mode,
          status: initialAssessment.status,
          scheduledAt: initialAssessment.scheduledAt ?? getDefaultScheduledAt(),
        }}
        description={t("edit-assessment-description")}
        errorMessage={t("update-assessment-failed")}
        formId={`school-assessment-edit-${initialAssessment._id}`}
        onSubmit={async (value) => {
          await updateAssessment({
            schoolId,
            assessmentId: initialAssessment._id,
            title: value.title,
            description: value.description
              ? {
                  format: "plate-v1",
                  json: JSON.stringify([
                    { type: "p", children: [{ text: value.description }] },
                  ]),
                  text: value.description,
                }
              : undefined,
            mode: value.mode,
            status: value.status,
            scheduledAt:
              value.status === "scheduled" ? value.scheduledAt : undefined,
          });
          toast.success(t("assessment-updated"));
        }}
        open={open}
        setOpenAction={setOpenAction}
        submitIcon={Edit01Icon}
        submitLabel={t("save")}
        title={t("edit-assessment-title")}
      />
    );
  }

  return (
    <AssessmentDialogShell
      defaultValues={{
        title: "",
        description: "",
        mode: "assignment",
        status: "draft",
        scheduledAt: getDefaultScheduledAt(),
      }}
      description={t("create-assessment-description")}
      errorMessage={t("create-assessment-failed")}
      formId="school-assessment-create-form"
      onSubmit={async (value) => {
        await createAssessment({
          schoolId,
          classId,
          title: value.title,
          description: value.description
            ? {
                format: "plate-v1",
                json: JSON.stringify([
                  { type: "p", children: [{ text: value.description }] },
                ]),
                text: value.description,
              }
            : undefined,
          mode: value.mode,
          status: value.status,
          scheduledAt:
            value.status === "scheduled" ? value.scheduledAt : undefined,
        });
      }}
      open={open}
      setOpenAction={setOpenAction}
      submitIcon={Add01Icon}
      submitLabel={t("create")}
      title={t("create-assessment")}
    />
  );
}

/** Render the shared assessment dialog shell used by assessment create flows. */
function AssessmentDialogShell({
  defaultValues,
  description,
  errorMessage,
  formId,
  onSubmit,
  open,
  setOpenAction,
  submitIcon,
  submitLabel,
  title,
}: AssessmentDialogShellProps) {
  const t = useTranslations("School.Classes");
  const locale = useLocale();

  const form = useForm({
    defaultValues,
    validators: {
      onChange: createAssessmentFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value);
        form.reset();
        setOpenAction(false);
      } catch (error) {
        captureException(error, {
          source: "school-assessment-create",
        });
        toast.error(errorMessage);
      }
    },
  });

  return (
    <form.Subscribe
      selector={(state) => [state.isSubmitting, state.values.status]}
    >
      {([isSubmitting, status]) => (
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
                    <Spinner icon={submitIcon} isLoading={isSubmitting} />
                    {submitLabel}
                  </Button>
                )}
              </form.Subscribe>
            }
            open={open}
            setOpen={(nextOpen) => {
              if (isSubmitting) {
                return;
              }

              setOpenAction(nextOpen);
            }}
            title={title}
          >
            <FieldGroup>
              <form.Field name="title">
                {(field) => {
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={`${formId}-title`}>
                        {t("assessment-title-label")}
                      </FieldLabel>
                      <Input
                        aria-invalid={isInvalid}
                        id={`${formId}-title`}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={t("assessment-title-placeholder")}
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
                        {t("assessment-description-label")}
                      </FieldLabel>
                      <Textarea
                        aria-invalid={isInvalid}
                        className="min-h-24"
                        id={`${formId}-description`}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={t("assessment-description-placeholder")}
                        value={field.state.value}
                      />
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="mode">
                {(field) => {
                  const currentMode = getAssessmentMode(field.state.value);
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={`${formId}-mode`}>
                        {t("assessment-mode-label")}
                      </FieldLabel>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-invalid={isInvalid}
                            className="w-full font-normal"
                            id={`${formId}-mode`}
                            name={field.name}
                            type="button"
                            variant="outline"
                          >
                            <HugeIcons icon={currentMode.icon} />
                            {t(currentMode.labelKey)}
                            <HugeIcons
                              className="ml-auto"
                              icon={ArrowDown01Icon}
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-(--radix-dropdown-menu-trigger-width)"
                        >
                          {assessmentModeList.map((option) => (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              key={option.value}
                              onSelect={() => field.handleChange(option.value)}
                            >
                              <HugeIcons icon={option.icon} />
                              {t(option.labelKey)}
                              <HugeIcons
                                className={cn(
                                  "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                  field.state.value === option.value &&
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

              <form.Field name="status">
                {(field) => {
                  const currentStatus = getAssessmentStatus(field.state.value);
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={`${formId}-status`}>
                        {t("assessment-status-label")}
                      </FieldLabel>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-invalid={isInvalid}
                            className="w-full font-normal"
                            id={`${formId}-status`}
                            name={field.name}
                            type="button"
                            variant="outline"
                          >
                            <HugeIcons icon={currentStatus.icon} />
                            {t(currentStatus.labelKey)}
                            <HugeIcons
                              className="ml-auto"
                              icon={ArrowDown01Icon}
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-(--radix-dropdown-menu-trigger-width)"
                        >
                          {assessmentStatusList.map((option) => (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              key={option.value}
                              onSelect={() => field.handleChange(option.value)}
                            >
                              <HugeIcons icon={option.icon} />
                              {t(option.labelKey)}
                              <HugeIcons
                                className={cn(
                                  "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                  field.state.value === option.value &&
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

              <Activity mode={status === "scheduled" ? "visible" : "hidden"}>
                <form.Field name="scheduledAt">
                  {(field) => {
                    const isInvalid =
                      Boolean(field.state.meta.isTouched) &&
                      Boolean(!field.state.meta.isValid);

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={`${formId}-scheduled-at`}>
                          {t("assessment-scheduled-at-label")}
                        </FieldLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              aria-invalid={isInvalid}
                              className="w-full font-normal"
                              id={`${formId}-scheduled-at`}
                              name={field.name}
                              type="button"
                              variant="outline"
                            >
                              <HugeIcons icon={Calendar03Icon} />
                              {field.state.value
                                ? formatScheduledAt(field.state.value, locale)
                                : t("assessment-scheduled-at-placeholder")}
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
            </FieldGroup>
          </ResponsiveDialog>
        </form>
      )}
    </form.Subscribe>
  );
}
