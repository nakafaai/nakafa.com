"use client";

import { Add01Icon, Edit01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { startOfDay } from "date-fns";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useState } from "react";
import { toast } from "sonner";
import { AssessmentDescriptionField } from "@/components/school/classes/assessments/dialog/description";
import { AssessmentModeField } from "@/components/school/classes/assessments/dialog/mode";
import { AssessmentScheduledAtField } from "@/components/school/classes/assessments/dialog/schedule";
import { AssessmentStatusField } from "@/components/school/classes/assessments/dialog/status";
import { AssessmentTitleField } from "@/components/school/classes/assessments/dialog/title";
import { useUpdateAssessmentMutation } from "@/components/school/classes/assessments/mutation.client";
import {
  type CreateAssessmentFormValues,
  createAssessmentFormSchema,
} from "@/components/school/classes/assessments/schema";
import type { Assessment } from "@/components/school/classes/assessments/types";
import { getDefaultScheduledAt } from "@/components/school/classes/schedule";
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
  const updateAssessment = useUpdateAssessmentMutation();

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
  const [minimumDate] = useState(() => startOfDay(new Date()));
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
                  toast.error(errorMessage);
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
            <FieldGroup>
              <form.Field name="title">
                {(field) => {
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <AssessmentTitleField
                      formId={formId}
                      isInvalid={isInvalid}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                  );
                }}
              </form.Field>

              <form.Field name="description">
                {(field) => {
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <AssessmentDescriptionField
                      formId={formId}
                      isInvalid={isInvalid}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                  );
                }}
              </form.Field>

              <form.Field name="mode">
                {(field) => {
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <AssessmentModeField
                      formId={formId}
                      isInvalid={isInvalid}
                      name={field.name}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                  );
                }}
              </form.Field>

              <form.Field name="status">
                {(field) => {
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);

                  return (
                    <AssessmentStatusField
                      formId={formId}
                      isInvalid={isInvalid}
                      name={field.name}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
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
                      <AssessmentScheduledAtField
                        formId={formId}
                        isInvalid={isInvalid}
                        locale={locale}
                        minimumDate={minimumDate}
                        name={field.name}
                        onValueChange={field.handleChange}
                        value={field.state.value}
                      />
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
