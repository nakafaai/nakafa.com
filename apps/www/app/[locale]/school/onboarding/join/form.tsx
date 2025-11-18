"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { MergeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { roles } from "@/lib/data/roles";

const formSchema = z.object({
  role: z.union([
    z.literal("teacher"),
    z.literal("student"),
    z.literal("parent"),
  ]),
  code: z.string().check(z.minLength(1), z.trim()),
});
type FormSchema = z.infer<typeof formSchema>;

export function SchoolOnboardingJoinForm() {
  const t = useTranslations("School.Onboarding");

  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: "teacher",
      code: "",
    } as const,
    mode: "onChange",
  });

  const onSubmit = (values: FormSchema) => {
    startTransition(() => {
      // TODO: Create school
      form.reset(values);
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
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("role")}</FormLabel>
                <FormControl>
                  <Select
                    defaultValue={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("role-placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <role.icon />
                          {t(role.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="px-2">{t("code")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("code-placeholder")} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </section>

        <Button disabled={isPending || !form.formState.isValid} type="submit">
          {isPending ? <SpinnerIcon /> : <MergeIcon />}
          {t("join")}
        </Button>
      </form>
    </Form>
  );
}

const roleOptions = roles.filter((role) => role.value !== "administrator");
