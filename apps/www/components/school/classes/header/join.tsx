"use client";

import { useMutation } from "@confect/react";
import { InLoveIcon, Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import refs from "@repo/backend/confect/_generated/refs";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { Effect, Schema } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

const form = Schema.Struct({
  code: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
});
const formSchema = Schema.toStandardSchemaV1(form);
const defaultValues = {
  code: "",
} satisfies Schema.Schema.Type<typeof form>;
export function SchoolClassesHeaderJoin() {
  const t = useTranslations("School.Classes");
  const pathname = usePathname();
  const router = useRouter();
  const [open, openHandlers] = useDisclosure(false);
  const joinClass = useMutation(refs.public.classes.mutations.joinClass);
  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise(() => joinClass(value)).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.tap(({ classId }) =>
            Effect.sync(() => {
              router.push(`${pathname}/${classId}`);
              openHandlers.close();
              form.reset();
            })
          ),
          Effect.matchEffect({
            onFailure: (error) =>
              reportClientException(error, {
                source: "school-class-join-header",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(t("join-class-failed"));
                  })
                )
              ),
            onSuccess: () => Effect.void,
          })
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
