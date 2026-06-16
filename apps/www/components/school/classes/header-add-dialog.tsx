"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HeaderAddNameField } from "@/components/school/classes/header-add-name-field";
import {
  classCreateDefaultValues,
  classCreateFormSchema,
} from "@/components/school/classes/header-add-schema";
import { HeaderAddSubjectField } from "@/components/school/classes/header-add-subject-field";
import { HeaderAddVisibilityField } from "@/components/school/classes/header-add-visibility-field";
import { HeaderAddYearField } from "@/components/school/classes/header-add-year-field";
import { reportClientException } from "@/lib/analytics/client";
import { useSchool } from "@/lib/context/use-school";

/** Render the school class creation dialog. */
export function CreateSchoolClassDialog({
  open,
  setOpenAction,
}: {
  open: boolean;
  setOpenAction: (open: boolean) => void;
}) {
  const t = useTranslations("School.Classes");
  const router = useRouter();
  const pathname = usePathname();
  const schoolId = useSchool((state) => state.school._id);
  const createClass = useMutation(api.classes.mutations.createClass);

  const form = useForm({
    defaultValues: classCreateDefaultValues,
    validators: {
      onChange: classCreateFormSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const classId = await createClass({
              ...value,
              schoolId,
            });

            router.push(`${pathname}/${classId}`);
            setOpenAction(false);
            form.reset();
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "school-class-create",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toast.error(t("create-class-failed"));
                })
              )
            )
          )
        )
      );
    },
  });

  return (
    <form
      action={() => form.handleSubmit()}
      id="school-classes-header-add-form"
    >
      <ResponsiveDialog
        description={t("create-class-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form="school-classes-header-add-form"
                type="submit"
              >
                <Spinner icon={Add01Icon} isLoading={isSubmitting} />
                {t("create")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpenAction}
        title={t("create-class")}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <HeaderAddNameField
                  isInvalid={isInvalid}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  value={field.state.value}
                />
              );
            }}
          </form.Field>

          <form.Field name="subject">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <HeaderAddSubjectField
                  isInvalid={isInvalid}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  value={field.state.value}
                />
              );
            }}
          </form.Field>

          <form.Field name="year">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <HeaderAddYearField
                  isInvalid={isInvalid}
                  name={field.name}
                  onValueChange={field.handleChange}
                  value={field.state.value}
                />
              );
            }}
          </form.Field>

          <form.Field name="visibility">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <HeaderAddVisibilityField
                  isInvalid={isInvalid}
                  name={field.name}
                  onValueChange={field.handleChange}
                  value={field.state.value}
                />
              );
            }}
          </form.Field>
        </FieldGroup>
      </ResponsiveDialog>
    </form>
  );
}
