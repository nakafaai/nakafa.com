"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { MergeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";

const formSchema = z.object({
  code: z.string().check(z.minLength(1), z.trim()),
});

const defaultValues: z.infer<typeof formSchema> = {
  code: "",
};

export function SchoolClassesHeaderJoin() {
  const t = useTranslations("School.Classes");

  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const joinClass = useMutation(api.classes.mutations.joinClass);

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const { classId } = await joinClass(value);
        router.push(`${pathname}/${classId}`);
        setOpen(false);
        form.reset();
      } catch {
        toast.error(t("join-class-failed"));
      }
    },
  });

  return (
    <form
      id="school-classes-header-join-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ButtonGroup>
        <Button onClick={() => setOpen(true)}>
          <MergeIcon />
          <span className="hidden sm:inline">{t("join-class")}</span>
        </Button>
      </ButtonGroup>

      <ResponsiveDialog
        description={t("join-class-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form="school-classes-header-join-form"
                type="submit"
              >
                {isSubmitting ? <SpinnerIcon /> : <MergeIcon />}
                {t("join")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpen}
        title={t("join-class")}
      >
        <FieldGroup>
          <form.Field name="code">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-join-code">
                    {t("code")}
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id="school-classes-header-join-code"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("code-placeholder")}
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>
      </ResponsiveDialog>
    </form>
  );
}
