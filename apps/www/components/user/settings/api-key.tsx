"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  Copy01Icon,
  Delete02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
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
  name: z
    .string()
    .check(
      z.minLength(MIN_NAME_LENGTH),
      z.maxLength(MAX_NAME_LENGTH),
      z.trim()
    ),
  expiresIn: z.number(),
});

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
    value: 0, // 0 means never expires
  },
] as const;

export function UserSettingsApiKey() {
  const t = useTranslations("Auth");
  const locale = useLocale();

  const clipboard = useClipboard({ timeout: 500 });

  const [confirmCreateApiKey, setConfirmCreateApiKey] = useState(false);
  const [confirmDeleteApiKey, setConfirmDeleteApiKey] = useState<string | null>(
    null
  );

  const [isPending, startTransition] = useTransition();

  const apiKeys = useQuery(api.users.queries.getCurrentUserApiKeys);

  const form = useForm({
    defaultValues: {
      name: "",
      expiresIn: 0,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      const { data, error } = await authClient.apiKey.create({
        name: value.name || "nakafa-api-key",
        expiresIn: value.expiresIn === 0 ? undefined : value.expiresIn,
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
    },
  });

  const handleCopyApiKey = (apiKey: string) => {
    clipboard.copy(apiKey);
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
    <form
      id="user-settings-api-key-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
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
              <HugeIcons icon={Add01Icon} />
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
                      <HugeIcons
                        icon={clipboard.copied ? Tick01Icon : Copy01Icon}
                      />
                      <span className="sr-only">Copy API Key</span>
                    </Button>
                    <Button
                      onClick={() => setConfirmDeleteApiKey(apiKey._id)}
                      size="icon-sm"
                      type="button"
                      variant="destructive"
                    >
                      <HugeIcons icon={Delete02Icon} />
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
          <Skeleton className="h-13.5 w-full border" />
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
            <Spinner icon={Delete02Icon} />
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
          <form.Subscribe
            selector={(state) => [
              state.isValid,
              state.isDirty,
              state.isSubmitting,
            ]}
          >
            {([isValid, isDirty, isSubmitting]) => {
              const canSubmit = Boolean(isValid) && Boolean(isDirty);
              const isDisabled = !canSubmit || Boolean(isSubmitting);
              return (
                <Button
                  disabled={isDisabled}
                  form="user-settings-api-key-form"
                  type="submit"
                >
                  <Spinner icon={Add01Icon} isLoading={isSubmitting} />
                  {t("create")}
                </Button>
              );
            }}
          </form.Subscribe>
        }
        open={confirmCreateApiKey}
        setOpen={setConfirmCreateApiKey}
        title={t("new-api-key")}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="api-key-name">
                    {t("api-key-name")}
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id="api-key-name"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("api-key-name-placeholder")}
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="expiresIn">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="api-key-expires-in">
                    {t("expires-in")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-invalid={isInvalid}
                        className={cn(
                          "justify-between font-normal",
                          field.state.value === 0 && "text-secondary!"
                        )}
                        id="api-key-expires-in"
                        name={field.name}
                        variant="outline"
                      >
                        {t(
                          expiresInList.find(
                            (item) => item.value === field.state.value
                          )?.label ?? "never"
                        )}
                        <HugeIcons icon={ArrowDown01Icon} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--radix-dropdown-menu-trigger-width)"
                    >
                      <DropdownMenuGroup>
                        {expiresInList.map((item) => (
                          <DropdownMenuItem
                            className={cn(
                              "cursor-pointer",
                              item.label === "never" && "text-secondary!"
                            )}
                            key={item.label}
                            onSelect={() => field.handleChange(item.value)}
                          >
                            {t(item.label)}

                            <HugeIcons
                              className={cn(
                                "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                field.state.value === item.value &&
                                  "opacity-100",
                                field.state.value === 0 && "text-secondary!"
                              )}
                              icon={Tick01Icon}
                            />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>
      </ResponsiveDialog>
    </form>
  );
}

function encryptApiKey(apiKey: string) {
  // Hide partially the api key
  return `${apiKey.slice(0, HIDDEN_PARTIAL_LENGTH)}...${apiKey.slice(-HIDDEN_PARTIAL_LENGTH)}`;
}
