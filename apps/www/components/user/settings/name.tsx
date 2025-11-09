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
import { Input } from "@repo/design-system/components/ui/input";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { FormBlock } from "@/components/shared/form-block";

const MAX_NAME_LENGTH = 32;
const MIN_NAME_LENGTH = 3;

const formSchema = z.object({
  name: z
    .string()
    .check(
      z.minLength(MIN_NAME_LENGTH),
      z.maxLength(MAX_NAME_LENGTH),
      z.trim()
    ),
});
type FormSchema = z.infer<typeof formSchema>;

export function UserSettingsName({ user }: { user: AppUser }) {
  const t = useTranslations("Auth");

  const updateUserName = useMutation(api.users.mutations.updateUserName);

  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.authUser.name,
    },
    mode: "onChange",
  });

  const onSubmit = (values: FormSchema) => {
    startTransition(async () => {
      await updateUserName({
        name: values.name,
      });
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormBlock
          description={t("name-description")}
          footer={
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                {t("name-footer")}
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
          title={t("name")}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">{t("name")}</FormLabel>
                <FormControl>
                  <Input
                    className="max-w-xs"
                    placeholder={t("name-placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </FormBlock>
      </form>
    </Form>
  );
}
