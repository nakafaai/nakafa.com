"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/design-system/components/ui/form";
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
import { useForm } from "react-hook-form";
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
    <Form {...form}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <section className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-name")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("school-name-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-email")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("school-email-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-phone")}</FormLabel>
                <FormControl>
                  <PhoneInput
                    placeholder={t("school-phone-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-address")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("school-address-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-city")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("school-city-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-province")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("school-province-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("school-type")}</FormLabel>
                <FormControl>
                  <Select
                    defaultValue={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
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
                </FormControl>
              </FormItem>
            )}
          />
        </section>

        <Button disabled={isPending || !form.formState.isValid} type="submit">
          {isPending ? <SpinnerIcon /> : <PartyPopperIcon />}
          {t("create")}
        </Button>
      </form>
    </Form>
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
