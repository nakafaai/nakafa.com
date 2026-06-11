"use client";

import { InLoveIcon, Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/overlays/responsive-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toastManager } from "@repo/design-system/components/ui/toast";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { reportClientException } from "@/lib/analytics/client";

const form = Schema.Struct({
  code: Schema.Trim.pipe(Schema.minLength(1)),
});

const formSchema = Schema.standardSchemaV1(form);

const defaultValues = {
  code: "",
} satisfies Schema.Schema.Type<typeof form>;

export function SchoolClassesHeaderJoin() {
  const t = useTranslations("School.Classes");

  const pathname = usePathname();
  const router = useRouter();

  const [open, openHandlers] = useDisclosure(false);

  const joinClass = useMutation(api.classes.mutations.joinClass);

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const { classId } = await joinClass(value);
            router.push(`${pathname}/${classId}`);
            openHandlers.close();
            form.reset();
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "school-class-join-header",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toastManager.add({
                    type: "error",
                    title: t("join-class-failed"),
                  });
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
      id="school-classes-header-join-form"
    >
      <Button onClick={openHandlers.open} type="button">
        <HugeIcons icon={Rocket01Icon} />
        <span className="hidden sm:inline">{t("join-class")}</span>
      </Button>

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
                <Spinner icon={InLoveIcon} isLoading={isSubmitting} />
                {t("join")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={openHandlers.set}
        title={t("join-class")}
      >
        <div className="flex w-full flex-col gap-3">
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
        </div>
      </ResponsiveDialog>
    </form>
  );
}
