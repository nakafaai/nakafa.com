"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow, startOfDay } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  Clock2Icon,
  CornerDownRightIcon,
  DotIcon,
  EllipsisIcon,
  FileTextIcon,
  FolderIcon,
  PenLineIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import type { ComponentProps } from "react";
import { Activity, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getMaterialStatus,
  materialStatusList,
} from "@/components/school/classes/_data/material-status";
import { useClass } from "@/lib/context/use-class";
import { searchParsers } from "@/lib/nuqs/search";
import { getLocale } from "@/lib/utils/date";
import {
  type MaterialGroupFormValues,
  materialGroupFormSchema,
} from "./schema";
import {
  formatScheduledAt,
  getMinTime,
  getTimeString,
  updateDate,
  updateTime,
} from "./utils";

type MaterialGroup = FunctionReturnType<
  typeof api.classes.materials.queries.getMaterialGroups
>["page"][number];

const DEBOUNCE_TIME = 500;

export function SchoolClassesMaterialsList() {
  const t = useTranslations("School.Classes");

  const [{ q }] = useQueryStates(searchParsers);

  const classId = useClass((state) => state.class._id);
  const classMembership = useClass((state) => state.classMembership);
  const schoolMembership = useClass((state) => state.schoolMembership);

  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);

  const { results, status, loadMore } = usePaginatedQuery(
    api.classes.materials.queries.getMaterialGroups,
    {
      classId,
      q: debouncedQ,
    },
    { initialNumItems: 50 }
  );

  const isTeacher = classMembership?.role === "teacher";
  const isAdmin = schoolMembership?.role === "admin";
  const canManage = isTeacher || isAdmin;

  if (status === "LoadingFirstPage") {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className="py-12">
        <p className="text-center text-muted-foreground text-sm">
          {t("no-materials-found")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
        {results.map((group) => (
          <MaterialGroupCard
            canManage={canManage}
            group={group}
            key={group._id}
          />
        ))}
      </section>
      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(25)} />
      )}
    </div>
  );
}

function MaterialGroupCard({
  group,
  canManage,
}: {
  group: MaterialGroup;
  canManage: boolean;
}) {
  const t = useTranslations("School.Classes");
  const locale = useLocale();

  const pathname = usePathname();

  const statusInfo = getMaterialStatus(group.status);
  const StatusIcon = statusInfo.icon;

  function getBadgeVariant(): ComponentProps<typeof Badge>["variant"] {
    switch (group.status) {
      case "published":
        return "secondary";
      case "draft":
        return "muted";
      case "scheduled":
        return "muted";
      case "archived":
        return "destructive";
      default:
        return "muted";
    }
  }

  return (
    <div className="group relative">
      <NavigationLink
        className="absolute inset-0 z-0 cursor-pointer"
        href={`${pathname}/${group._id}`}
      >
        <span className="sr-only">{group.name}</span>
      </NavigationLink>

      <Activity mode={canManage ? "visible" : "hidden"}>
        <MaterialGroupActions
          className="absolute top-4 right-4 z-1"
          group={group}
        />
      </Activity>

      <div
        className={cn(
          "pointer-events-none flex flex-col gap-3 p-4 transition-colors ease-out group-hover:bg-accent/20",
          canManage && "pr-14"
        )}
      >
        <Activity mode={canManage ? "visible" : "hidden"}>
          <Badge className="w-fit" variant={getBadgeVariant()}>
            <StatusIcon className="size-3" />
            {group.status === "scheduled" && group.scheduledAt
              ? formatScheduledAt(group.scheduledAt, locale)
              : t(statusInfo.value)}
          </Badge>
        </Activity>

        <div className="grid gap-1 text-left">
          <h3 className="min-w-0 truncate font-medium">{group.name}</h3>

          <div className="flex min-w-0 items-center gap-1 text-muted-foreground text-sm">
            <CornerDownRightIcon className="size-3 shrink-0" />
            <p className="min-w-0 truncate">{group.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <div className="flex items-center gap-1">
            <FileTextIcon className="size-3.5" />
            <span className="tracking-tight">{group.materialCount}</span>
          </div>

          <DotIcon className="size-3.5 shrink-0" />
          <div className="flex items-center gap-1">
            <FolderIcon className="size-3.5" />
            <span className="tracking-tight">{group.childGroupCount}</span>
          </div>

          <DotIcon className="size-3.5 shrink-0" />

          <time className="min-w-0 truncate tracking-tight">
            {formatDistanceToNow(group.updatedAt, {
              locale: getLocale(locale),
              addSuffix: true,
            })}
          </time>
        </div>
      </div>
    </div>
  );
}

function MaterialGroupActions({
  group,
  className,
}: {
  group: MaterialGroup;
  className?: string;
}) {
  const t = useTranslations("Common");

  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  const reorderGroup = useMutation(
    api.classes.materials.mutations.reorderMaterialGroup
  );
  const deleteGroup = useMutation(
    api.classes.materials.mutations.deleteMaterialGroup
  );

  function handleMoveUp() {
    startTransition(() => {
      reorderGroup({ groupId: group._id, direction: "up" });
    });
  }

  function handleMoveDown() {
    startTransition(() => {
      reorderGroup({ groupId: group._id, direction: "down" });
    });
  }

  function handleDelete() {
    startTransition(() => {
      deleteGroup({ groupId: group._id });
    });
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="pointer-events-auto z-1 opacity-50 transition-opacity ease-out group-hover:opacity-100"
            disabled={isPending}
            size="icon-sm"
            variant="ghost"
          >
            <EllipsisIcon />
            <span className="sr-only">{t("more-actions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={() => setEditOpen(true)}
            >
              <PenLineIcon />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={handleMoveUp}
            >
              <ArrowUpIcon />
              {t("move-up")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={handleMoveDown}
            >
              <ArrowDownIcon />
              {t("move-down")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={handleDelete}
              variant="destructive"
            >
              <Trash2Icon />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMaterialGroupDialog
        group={group}
        open={editOpen}
        setOpen={setEditOpen}
      />
    </div>
  );
}

function EditMaterialGroupDialog({
  group,
  open,
  setOpen,
}: {
  group: MaterialGroup;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("School.Classes");
  const locale = useLocale();

  const updateGroup = useMutation(
    api.classes.materials.mutations.updateMaterialGroup
  );

  const defaultValues: MaterialGroupFormValues = {
    name: group.name,
    description: group.description,
    status: group.status,
    scheduledAt: group.scheduledAt,
  };

  const form = useForm({
    defaultValues,
    validators: {
      onChange: materialGroupFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateGroup({
          groupId: group._id,
          name: value.name,
          description: value.description,
          status: value.status,
          scheduledAt:
            value.status === "scheduled" ? value.scheduledAt : undefined,
        });
        setOpen(false);
      } catch {
        toast.error(t("update-material-group-failed"));
      }
    },
  });

  return (
    <form
      id={`edit-material-group-${group._id}`}
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ResponsiveDialog
        description={t("edit-material-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form={`edit-material-group-${group._id}`}
                type="submit"
              >
                {isSubmitting ? <SpinnerIcon /> : <SaveIcon />}
                {t("save")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpen}
        title={t("edit-material-title")}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={`edit-material-name-${group._id}`}>
                    {t("material-name-label")}
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={`edit-material-name-${group._id}`}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("material-name-placeholder")}
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="description">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel
                    htmlFor={`edit-material-description-${group._id}`}
                  >
                    {t("material-description-label")}
                  </FieldLabel>
                  <Textarea
                    aria-invalid={isInvalid}
                    className="min-h-24"
                    id={`edit-material-description-${group._id}`}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("material-description-placeholder")}
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="status">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);
              const currentStatus = getMaterialStatus(field.state.value);
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={`edit-material-status-${group._id}`}>
                    {t("material-status-label")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-invalid={isInvalid}
                        className="w-full font-normal"
                        id={`edit-material-status-${group._id}`}
                        name={field.name}
                        variant="outline"
                      >
                        <currentStatus.icon />
                        {t(currentStatus.labelKey)}
                        <ChevronDownIcon className="ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--radix-dropdown-menu-trigger-width)"
                    >
                      {materialStatusList.map((status) => (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          key={status.value}
                          onSelect={() => field.handleChange(status.value)}
                        >
                          <status.icon />
                          {t(status.labelKey)}
                          <CheckIcon
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === status.value &&
                                "opacity-100"
                            )}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe selector={(state) => [state.values.status]}>
            {([status]) => (
              <Activity mode={status === "scheduled" ? "visible" : "hidden"}>
                <form.Field name="scheduledAt">
                  {(field) => {
                    const isInvalid =
                      Boolean(field.state.meta.isTouched) &&
                      Boolean(!field.state.meta.isValid);
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel
                          htmlFor={`edit-material-scheduled-at-${group._id}`}
                        >
                          {t("material-scheduled-at-label")}
                        </FieldLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              aria-invalid={isInvalid}
                              className="w-full font-normal"
                              id={`edit-material-scheduled-at-${group._id}`}
                              name={field.name}
                              variant="outline"
                            >
                              <CalendarIcon />
                              {field.state.value
                                ? formatScheduledAt(field.state.value, locale)
                                : t("material-scheduled-at-placeholder")}
                              <ChevronDownIcon className="ml-auto" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-auto overflow-hidden p-0"
                          >
                            <Calendar
                              disabled={{ before: startOfDay(new Date()) }}
                              mode="single"
                              onSelect={(date) => {
                                if (date) {
                                  field.handleChange(
                                    updateDate(field.state.value, date)
                                  );
                                }
                              }}
                              selected={
                                field.state.value
                                  ? new Date(field.state.value)
                                  : undefined
                              }
                            />
                            <div className="border-t p-3">
                              <div className="flex flex-col gap-2">
                                <FieldLabel
                                  htmlFor={`edit-material-scheduled-time-${group._id}`}
                                >
                                  {t("material-scheduled-time-label")}
                                </FieldLabel>
                                <div className="relative flex w-full items-center">
                                  <Clock2Icon className="pointer-events-none absolute left-3 size-4 select-none text-muted-foreground" />
                                  <Input
                                    className="cursor-text appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                    id={`edit-material-scheduled-time-${group._id}`}
                                    min={getMinTime(field.state.value)}
                                    onChange={(e) => {
                                      if (field.state.value) {
                                        field.handleChange(
                                          updateTime(
                                            field.state.value,
                                            e.target.value
                                          )
                                        );
                                      }
                                    }}
                                    type="time"
                                    value={
                                      field.state.value
                                        ? getTimeString(field.state.value)
                                        : ""
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </Field>
                    );
                  }}
                </form.Field>
              </Activity>
            )}
          </form.Subscribe>
        </FieldGroup>
      </ResponsiveDialog>
    </form>
  );
}
