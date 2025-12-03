"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Particles } from "@repo/design-system/components/ui/particles";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { MergeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import * as z from "zod/mini";

const formSchema = z.object({
  code: z.string().check(z.minLength(1), z.trim()),
});

const defaultValues: z.infer<typeof formSchema> = {
  code: "",
};

export function SchoolClassesJoinForm() {
  const t = useTranslations("School.Classes");

  const router = useRouter();
  const joinClass = useMutation(api.classes.mutations.joinClass);

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await joinClass(value);
        router.refresh();
      } catch {
        toast.error(t("join-class-failed"));
      }
    },
  });

  return (
    <main className="relative flex h-full">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="z-1 m-auto w-full max-w-xl space-y-6 px-6 py-12">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form
            className="flex flex-col gap-6"
            id="school-classes-join-form"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="code">
                {(field) => {
                  const isInvalid =
                    Boolean(field.state.meta.isTouched) &&
                    Boolean(!field.state.meta.isValid);
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="school-classes-join-code">
                        {t("code")}
                      </FieldLabel>
                      <Input
                        aria-invalid={isInvalid}
                        id="school-classes-join-code"
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

            <form.Subscribe
              selector={(state) => [state.isValid, state.isSubmitting]}
            >
              {([isValid, isSubmitting]) => {
                const canSubmit = Boolean(isValid);
                const isDisabled = !canSubmit || Boolean(isSubmitting);
                return (
                  <Button disabled={isDisabled} type="submit">
                    {isSubmitting ? <SpinnerIcon /> : <MergeIcon />}
                    {t("join")}
                  </Button>
                );
              }}
            </form.Subscribe>
          </form>
        </div>
      </div>
    </main>
  );
}
