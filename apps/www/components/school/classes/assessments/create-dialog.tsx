"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  Edit01Icon,
  Tick01Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/overlays/responsive-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { startOfDay } from "date-fns";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useState } from "react";
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
import { reportClientException } from "@/lib/analytics/client";
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
          toastManager.add({ type: "success", title: t("assessment-updated") });
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
  const [minimumDate] = useState(() => startOfDay(new Date()));
  const t = useTranslations("School.Classes");
  const locale = useLocale();

  const form = useForm({
    defaultValues,
    validators: {
      onChange: createAssessmentFormSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            await onSubmit(value);
            form.reset();
            setOpenAction(false);
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "school-assessment-create",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toastManager.add({ type: "error", title: errorMessage });
                })
              )
            )
          )
        )
      );
    },
  });

  return (
    <form.Subscribe
      selector={(state) => [state.isSubmitting, state.values.status]}
    >
      {([isSubmitting, status]) => (
        <form action={() => form.handleSubmit()} id={formId}>
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
            <div className="flex w-full flex-col gap-3">
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
                      <Menu>
                        <MenuTrigger
                          render={
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
                          }
                        />
                        <MenuPopup align="start" className="w-(--anchor-width)">
                          {assessmentModeList.map((option) => (
                            <MenuItem
                              key={option.value}
                              onClick={() => field.handleChange(option.value)}
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
                            </MenuItem>
                          ))}
                        </MenuPopup>
                      </Menu>
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
                      <Menu>
                        <MenuTrigger
                          render={
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
                          }
                        />
                        <MenuPopup align="start" className="w-(--anchor-width)">
                          {assessmentStatusList.map((option) => (
                            <MenuItem
                              key={option.value}
                              onClick={() => field.handleChange(option.value)}
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
                            </MenuItem>
                          ))}
                        </MenuPopup>
                      </Menu>
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
                          <PopoverTrigger
                            render={
                              <Button
                                aria-invalid={isInvalid}
                                className="w-full font-normal"
                                id={`${formId}-scheduled-at`}
                                name={field.name}
                                type="button"
                                variant="outline"
                              />
                            }
                          >
                            <HugeIcons icon={Calendar03Icon} />
                            {field.state.value
                              ? formatScheduledAt(field.state.value, locale)
                              : t("assessment-scheduled-at-placeholder")}
                            <HugeIcons
                              className="ml-auto"
                              icon={ArrowDown01Icon}
                            />
                          </PopoverTrigger>
                          <PopoverPopup
                            align="start"
                            className="w-auto overflow-hidden p-0"
                          >
                            <Calendar
                              disabled={{ before: minimumDate }}
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
                          </PopoverPopup>
                        </Popover>
                      </Field>
                    );
                  }}
                </form.Field>
              </Activity>
            </div>
          </ResponsiveDialog>
        </form>
      )}
    </form.Subscribe>
  );
}
