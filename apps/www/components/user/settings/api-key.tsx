"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
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
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { FormBlock } from "@/components/shared/form-block";
import { authClient } from "@/lib/auth/client";
import { getLocale } from "@/lib/utils/date";

const HIDDEN_PARTIAL_LENGTH = 8;
const MAX_NAME_LENGTH = 32;
const MIN_NAME_LENGTH = 3;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_QUARTER = 90;
const DAYS_PER_YEAR = 365;
const SECONDS_PER_DAY = 60 * 60 * 24;

const formSchema = z.object({
  name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH),
  expiresIn: z.number().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

// value in seconds
const expiresInList = [
  {
    label: "1-day",
    value: SECONDS_PER_DAY,
  },
  {
    label: "7-days",
    value: SECONDS_PER_DAY * DAYS_PER_WEEK,
  },
  {
    label: "30-days",
    value: SECONDS_PER_DAY * DAYS_PER_MONTH,
  },
  {
    label: "90-days",
    value: SECONDS_PER_DAY * DAYS_PER_QUARTER,
  },
  {
    label: "180-days",
    value: (SECONDS_PER_DAY * DAYS_PER_YEAR) / 2,
  },
  {
    label: "365-days",
    value: SECONDS_PER_DAY * DAYS_PER_YEAR,
  },
  {
    label: "never",
    value: undefined,
  },
] as const;

export function UserSettingsApiKey() {
  const t = useTranslations("Auth");
  const locale = useLocale();

  const [confirmCreateApiKey, setConfirmCreateApiKey] = useState(false);
  const [confirmDeleteApiKey, setConfirmDeleteApiKey] = useState<string | null>(
    null
  );

  const [isPending, startTransition] = useTransition();

  const apiKeys = useQuery(api.users.queries.getCurrentUserApiKeys);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      expiresIn: undefined,
    },
    mode: "onChange",
  });

  const onSubmit = (values: FormSchema) => {
    startTransition(async () => {
      const { data, error } = await authClient.apiKey.create({
        name: values.name,
        expiresIn: values.expiresIn,
        prefix: "nakafa",
      });

      if (error) {
        toast.error(error.message, {
          position: "bottom-center",
        });
        return;
      }

      if (data) {
        toast.success(t("api-key-created"), {
          position: "bottom-center",
        });
        setConfirmCreateApiKey(false);
        form.reset();
      }
    });
  };

  const handleCopyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast.success(t("api-key-copied"), {
      position: "bottom-center",
    });
  };

  const handleDeleteApiKey = (keyId: string) => {
    startTransition(async () => {
      const { data, error } = await authClient.apiKey.delete({
        keyId,
      });

      if (error) {
        toast.error(error.message, {
          position: "bottom-center",
        });
        return;
      }

      if (data) {
        toast.success(t("api-key-deleted"), {
          position: "bottom-center",
        });
        setConfirmDeleteApiKey(null);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormBlock
          description={t("api-key-description")}
          footer={
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                {t("api-key-footer")}
              </p>
              <Button
                disabled={isPending}
                onClick={() => setConfirmCreateApiKey(true)}
                size="sm"
                type="button"
              >
                <PlusIcon />
                {t("new-api-key")}
              </Button>
            </div>
          }
          title={t("api-key")}
        >
          {apiKeys ? (
            <div className="flex flex-col divide-y rounded-md border">
              {apiKeys.length > 0 ? (
                apiKeys.map((apiKey) => (
                  <div className="flex flex-col gap-4 p-4" key={apiKey._id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="truncate font-medium text-sm">
                          {apiKey.name}
                        </p>
                        <button
                          className="w-fit cursor-pointer truncate font-mono text-muted-foreground text-sm tracking-tight"
                          onClick={() => handleCopyApiKey(apiKey.key)}
                          type="button"
                        >
                          {encryptApiKey(apiKey.key)}
                        </button>
                      </div>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Badge className="lowercase" variant="muted">
                              {apiKey.expiresAt
                                ? formatDistanceToNow(apiKey.expiresAt, {
                                    locale: getLocale(locale),
                                  })
                                : t("never")}
                            </Badge>
                          }
                        />
                        <TooltipContent>{t("expires")}</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleCopyApiKey(apiKey.key)}
                        size="icon-sm"
                        type="button"
                        variant="secondary"
                      >
                        <CopyIcon className="size-4" />
                        <span className="sr-only">Copy API Key</span>
                      </Button>
                      <Button
                        onClick={() => setConfirmDeleteApiKey(apiKey._id)}
                        size="icon-sm"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">Delete API Key</span>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="flex items-center justify-center p-4 text-muted-foreground text-sm">
                  {t("no-api-keys")}
                </p>
              )}
            </div>
          ) : (
            <Skeleton className="h-[54px] w-full border" />
          )}
        </FormBlock>

        <ResponsiveDialog
          description={t("delete-api-key-description")}
          footer={
            <Button
              disabled={isPending}
              onClick={() => {
                if (confirmDeleteApiKey) {
                  handleDeleteApiKey(confirmDeleteApiKey);
                }
              }}
              variant="destructive"
            >
              {isPending ? <SpinnerIcon /> : <Trash2Icon />}
              {t("delete")}
            </Button>
          }
          open={Boolean(confirmDeleteApiKey)}
          setOpen={(open) =>
            setConfirmDeleteApiKey(open ? confirmDeleteApiKey : null)
          }
          title={t("delete-api-key")}
        />

        <ResponsiveDialog
          description={t("api-key-confirmation-description")}
          footer={
            <Button
              disabled={isPending || !form.formState.isValid}
              onClick={() => form.handleSubmit(onSubmit)()}
              type="button"
            >
              {isPending ? <SpinnerIcon /> : <PlusIcon />}
              {t("create")}
            </Button>
          }
          open={confirmCreateApiKey}
          setOpen={setConfirmCreateApiKey}
          title={t("new-api-key")}
        >
          <div className="grid gap-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("api-key-name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("api-key-name-placeholder")}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiresIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("expires-in")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(
                        value === "never" ? undefined : Number(value)
                      );
                    }}
                    value={
                      field.value === undefined ? "never" : String(field.value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger
                        className={cn(
                          "w-full",
                          field.value === undefined &&
                            "[&_span]:text-destructive!"
                        )}
                      >
                        <SelectValue
                          placeholder={t("expires-in-placeholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {expiresInList.map((item) => (
                          <SelectItem
                            className={cn(
                              item.label === "never" && "text-destructive!"
                            )}
                            key={item.label}
                            value={
                              item.value === undefined
                                ? "never"
                                : String(item.value)
                            }
                          >
                            {t(item.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
        </ResponsiveDialog>
      </form>
    </Form>
  );
}

function encryptApiKey(apiKey: string) {
  // Hide partially the api key
  return `${apiKey.slice(0, HIDDEN_PARTIAL_LENGTH)}...${apiKey.slice(-HIDDEN_PARTIAL_LENGTH)}`;
}
