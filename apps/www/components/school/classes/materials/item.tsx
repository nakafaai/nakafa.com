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
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import NavigationLink from "@repo/design-system/components/navigation/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import { toastManager } from "@repo/design-system/components/ui/toast";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Activity, useTransition } from "react";
import { getMaterialStatus } from "@/components/school/classes/_data/material-status";
import { SchoolClassesDeleteDialog } from "@/components/school/classes/delete-dialog";
import { EditMaterialGroupDialog } from "@/components/school/classes/materials/editor-dialog";
import type { MaterialGroup } from "@/components/school/classes/materials/types";
import { formatScheduledAt } from "@/components/school/classes/materials/utils";
import { getLocale } from "@/lib/utils/date";

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
      return "outline";
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
            <TooltipPopup side="bottom">{t("material-items")}</TooltipPopup>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <div className="pointer-events-auto relative z-1 flex items-center gap-1">
                <HugeIcons className="size-3.5" icon={Folder01Icon} />
                <span className="tracking-tight">{group.childGroupCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipPopup side="bottom">{t("material-groups")}</TooltipPopup>
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
  const [confirmDeleteOpen, confirmDeleteHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);

  const reorderGroup = useMutation(
    api.classes.materials.mutations.reorderMaterialGroup
  );
  const deleteGroup = useMutation(
    api.classes.materials.mutations.deleteMaterialGroup
  );

  function handleMoveUp() {
    startTransition(async () => {
      await reorderGroup({ groupId: group._id, direction: "up" });
    });
  }

  function handleMoveDown() {
    startTransition(async () => {
      await reorderGroup({ groupId: group._id, direction: "down" });
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            await deleteGroup({ groupId: group._id });
            toastManager.add({
              type: "success",
              title: schoolT("material-deleted"),
            });
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll(() =>
            Effect.sync(() => {
              toastManager.add({
                type: "error",
                title: schoolT("delete-material-failed"),
              });
            })
          )
        )
      );
    });
  }

  return (
    <div className={className}>
      <Menu>
        <MenuTrigger
          render={
            <Button
              className="pointer-events-auto z-1 opacity-50 transition-opacity ease-out group-hover:opacity-100"
              disabled={isPending}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
              <span className="sr-only">{t("more-actions")}</span>
            </Button>
          }
        />
        <MenuPopup align="end" className="w-48">
          <MenuGroup>
            <MenuItem disabled={isPending} onClick={editHandlers.open}>
              <HugeIcons icon={Edit01Icon} />
              {t("edit")}
            </MenuItem>
            <MenuItem disabled={isPending} onClick={handleMoveUp}>
              <HugeIcons icon={ArrowUp02Icon} />
              {t("move-up")}
            </MenuItem>
            <MenuItem disabled={isPending} onClick={handleMoveDown}>
              <HugeIcons icon={ArrowDown02Icon} />
              {t("move-down")}
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup>
            <MenuItem
              disabled={isPending}
              onClick={confirmDeleteHandlers.open}
              variant="destructive"
            >
              <HugeIcons icon={Delete02Icon} />
              {t("delete")}
            </MenuItem>
          </MenuGroup>
        </MenuPopup>
      </Menu>

      <EditMaterialGroupDialog
        group={group}
        open={editOpen}
        setOpenAction={editHandlers.set}
      />

      <SchoolClassesDeleteDialog
        description={schoolT("delete-material-description")}
        isPending={isPending}
        onConfirmAction={handleDelete}
        open={confirmDeleteOpen}
        setOpenAction={confirmDeleteHandlers.set}
        title={schoolT("delete-material-title")}
      />
    </div>
  );
}
