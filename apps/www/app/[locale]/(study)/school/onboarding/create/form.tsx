"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import PhoneInput from "@repo/design-system/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { PartyPopperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod/mini";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;

const formSchema = z.object({
  name: z
    .string()
    .check(
      z.minLength(MIN_NAME_LENGTH),
      z.maxLength(MAX_NAME_LENGTH),
      z.trim()
    ),
  email: z.string().check(z.email()),
  phone: z.string().check(z.minLength(1), z.trim()),
  address: z.string().check(z.minLength(1), z.trim()),
  city: z.string().check(z.minLength(1), z.trim()),
  province: z.string().check(z.minLength(1), z.trim()),
  type: z.union([
    z.literal("elementary-school"),
    z.literal("middle-school"),
    z.literal("high-school"),
    z.literal("vocational-school"),
    z.literal("university"),
    z.literal("other"),
  ]),
});
type FormSchema = z.infer<typeof formSchema>;

export function SchoolOnboardingCreateForm() {
  const t = useTranslations("School.Onboarding");

  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const createSchool = useMutation(api.schools.mutations.createSchool);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      province: "",
      type: "high-school",
    } as const,
    mode: "onChange",
  });

  const onSubmit = (values: FormSchema) => {
    startTransition(async () => {
      try {
        const { slug } = await createSchool(values);
        router.push(`/school/${slug}`);
      } catch {
        toast.error(t("school-creation-failed"));
      }
    });
  };

  return (
    <form
      className="flex flex-col gap-6"
      id="school-onboarding-create-form"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-name">{t("school-name")}</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-name"
                placeholder={t("school-name-placeholder")}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-email">
                {t("school-email")}
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-email"
                placeholder={t("school-email-placeholder")}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-phone">
                {t("school-phone")}
              </FieldLabel>
              <PhoneInput
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-phone"
                placeholder={t("school-phone-placeholder")}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="address"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-address">
                {t("school-address")}
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-address"
                placeholder={t("school-address-placeholder")}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="city"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-city">{t("school-city")}</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-city"
                placeholder={t("school-city-placeholder")}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="province"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-province">
                {t("school-province")}
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id="school-province"
                placeholder={t("school-province-placeholder")}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="type"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="school-type">{t("school-type")}</FieldLabel>

              <Select
                defaultValue={field.value ?? undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                  id="school-type"
                >
                  <SelectValue placeholder={t("school-type-placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {schoolTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
      </FieldGroup>

      <Button disabled={isPending || !form.formState.isValid} type="submit">
        {isPending ? <SpinnerIcon /> : <PartyPopperIcon />}
        {t("create")}
      </Button>
    </form>
  );
}

const schoolTypeOptions = [
  {
    value: "elementary-school",
  },
  {
    value: "middle-school",
  },
  {
    value: "high-school",
  },
  {
    value: "vocational-school",
  },
  {
    value: "university",
  },
  {
    value: "other",
  },
] as const;
