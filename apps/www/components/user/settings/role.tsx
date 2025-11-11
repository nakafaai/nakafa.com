"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@repo/backend/convex/_generated/api";
import type { AppUser } from "@repo/backend/convex/auth";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/design-system/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { FormBlock } from "@/components/shared/form-block";
import { roles } from "@/lib/data/roles";

const formSchema = z.object({
  role: z.union([
    z.literal("teacher"),
    z.literal("student"),
    z.literal("parent"),
    z.literal("admin"),
  ]),
});
type FormSchema = z.infer<typeof formSchema>;

export function UserSettingsRole({ user }: { user: AppUser }) {
  const t = useTranslations("Auth");

  const updateUserRole = useMutation(api.users.mutations.updateUserRole);

  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: user.appUser.role ?? undefined,
    },
    mode: "onChange",
  });

  const onSubmit = (values: FormSchema) => {
    startTransition(async () => {
      await updateUserRole({
        role: values.role,
      });
      // Reset form state after successful save
      form.reset(values);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormBlock
          description={t("role-description")}
          footer={
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                {t("role-footer")}
              </p>
              <Button
                disabled={
                  isPending ||
                  !form.formState.isValid ||
                  !form.formState.isDirty
                }
                size="sm"
                type="submit"
              >
                {t("save")}
              </Button>
            </div>
          }
          title={t("role")}
        >
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">{t("role")}</FormLabel>
                <FormControl>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder={t("role-placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
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
        </FormBlock>
      </form>
    </Form>
  );
}
