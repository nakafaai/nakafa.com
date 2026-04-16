"use client";

import {
  ArrowDown02Icon,
  ArrowTurnForwardIcon,
  ArrowUp02Icon,
  Delete02Icon,
  Edit01Icon,
  File01Icon,
  Folder01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Activity, useState, useTransition } from "react";
import { toast } from "sonner";
import { getMaterialStatus } from "@/components/school/classes/_data/material-status";
import { SchoolClassesDeleteDialog } from "@/components/school/classes/delete-dialog";
import { getLocale } from "@/lib/utils/date";
import { EditMaterialGroupDialog } from "./editor-dialog";
import type { MaterialGroup } from "./types";
import { formatScheduledAt } from "./utils";

/** Return the badge variant used for one material-group status. */
function getBadgeVariant(
  status: MaterialGroup["status"]
): ComponentProps<typeof Badge>["variant"] {
  switch (status) {
    case "published":
      return "secondary";
    case "archived":
      return "destructive";
    default:
      return "muted";
  }
}

/** Render one material-group row in the class materials list. */
export function MaterialGroupCard({
  canManage,
  group,
}: {
  canManage: boolean;
  group: MaterialGroup;
}) {
  const t = useTranslations("School.Classes");
  const locale = useLocale();
  const pathname = usePathname();

  const statusInfo = getMaterialStatus(group.status);
  const StatusIcon = statusInfo.icon;

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
          <Badge className="w-fit" variant={getBadgeVariant(group.status)}>
            <HugeIcons className="size-3" icon={StatusIcon} />
            {group.status === "scheduled" && group.scheduledAt
              ? formatScheduledAt(group.scheduledAt, locale)
              : t(statusInfo.value)}
          </Badge>
        </Activity>

        <div className="grid gap-1 text-left">
          <h3 className="min-w-0 truncate font-medium">{group.name}</h3>

          <div className="flex min-w-0 items-center gap-1 text-muted-foreground text-sm">
            <HugeIcons
              className="size-3 shrink-0"
              icon={ArrowTurnForwardIcon}
            />
            <p className="min-w-0 truncate">{group.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Tooltip>
            <TooltipTrigger>
              <div className="pointer-events-auto relative z-1 flex items-center gap-1">
                <HugeIcons className="size-3.5" icon={File01Icon} />
                <span className="tracking-tight">{group.materialCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("material-items")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <div className="pointer-events-auto relative z-1 flex items-center gap-1">
                <HugeIcons className="size-3.5" icon={Folder01Icon} />
                <span className="tracking-tight">{group.childGroupCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("material-groups")}
            </TooltipContent>
          </Tooltip>

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

/** Render the management dropdown for one material group. */
function MaterialGroupActions({
  className,
  group,
}: {
  className?: string;
  group: MaterialGroup;
}) {
  const t = useTranslations("Common");
  const schoolT = useTranslations("School.Classes");

  const [isPending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
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
    startTransition(async () => {
      try {
        await deleteGroup({ groupId: group._id });
        toast.success(schoolT("material-deleted"));
      } catch {
        toast.error(schoolT("delete-material-failed"));
      }
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
            <HugeIcons icon={MoreHorizontalIcon} />
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
              <HugeIcons icon={Edit01Icon} />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={handleMoveUp}
            >
              <HugeIcons icon={ArrowUp02Icon} />
              {t("move-up")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={handleMoveDown}
            >
              <HugeIcons icon={ArrowDown02Icon} />
              {t("move-down")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={() => setConfirmDeleteOpen(true)}
              variant="destructive"
            >
              <HugeIcons icon={Delete02Icon} />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMaterialGroupDialog
        group={group}
        open={editOpen}
        setOpenAction={setEditOpen}
      />

      <SchoolClassesDeleteDialog
        description={schoolT("delete-material-description")}
        isPending={isPending}
        onConfirmAction={handleDelete}
        open={confirmDeleteOpen}
        setOpenAction={setConfirmDeleteOpen}
        title={schoolT("delete-material-title")}
      />
    </div>
  );
}
