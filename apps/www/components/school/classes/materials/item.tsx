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
import { usePathname } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import { formatDistanceToNow } from "date-fns";
import { Effect, Match } from "effect";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Activity, useTransition } from "react";
import { toast } from "sonner";
import { SchoolClassesDeleteDialog } from "@/components/school/classes/deletion";
import { EditMaterialGroupDialog } from "@/components/school/classes/materials/editor";
import {
  useDeleteMaterialGroupMutation,
  useReorderMaterialGroupMutation,
} from "@/components/school/classes/materials/mutation.client";
import { getMaterialStatus } from "@/components/school/classes/materials/status";
import type { MaterialGroup } from "@/components/school/classes/materials/types";
import { formatScheduledAt } from "@/components/school/classes/schedule";
import { reportClientException } from "@/lib/analytics/client";
import { getLocale } from "@/lib/i18n/date";

/** Return the badge variant used for one material-group status. */
function getBadgeVariant(
  status: MaterialGroup["status"]
): ComponentProps<typeof Badge>["variant"] {
  return Match.value(status).pipe(
    Match.withReturnType<ComponentProps<typeof Badge>["variant"]>(),
    Match.when("published", () => "secondary"),
    Match.when("archived", () => "destructive"),
    Match.orElse(() => "muted")
  );
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
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Common");
  const schoolT = useTranslations("School.Classes");
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteOpen, confirmDeleteHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const reorderGroup = useReorderMaterialGroupMutation();
  const deleteGroup = useDeleteMaterialGroupMutation();

  /** Move this material group one loaded position upward. */
  function handleMoveUp() {
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(
          Effect.tryPromise(() =>
            reorderGroup({
              groupId: group._id,
              direction: "up",
            })
          ).pipe(Effect.flatMap(Effect.fromResult))
        ).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/school/classes/materials/item",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  }

  /** Move this material group one loaded position downward. */
  function handleMoveDown() {
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(
          Effect.tryPromise(() =>
            reorderGroup({
              groupId: group._id,
              direction: "down",
            })
          ).pipe(Effect.flatMap(Effect.fromResult))
        ).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/school/classes/materials/item",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  }

  /** Delete this material group and report an unexpected failure. */
  function handleDelete() {
    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise(() =>
          deleteGroup({
            groupId: group._id,
          })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.tap(() =>
            Effect.sync(() => {
              toast.success(schoolT("material-deleted"));
            })
          ),
          Effect.catch(() =>
            Effect.sync(() => {
              toast.error(schoolT("delete-material-failed"));
            })
          )
        )
      );
    });
  }
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="pointer-events-auto z-1 text-muted-foreground focus-visible:text-foreground group-hover:text-foreground"
              disabled={isPending}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
              <span className="sr-only">{t("more-actions")}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onClick={editHandlers.open}
            >
              <HugeIcons icon={Edit01Icon} />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onClick={handleMoveUp}
            >
              <HugeIcons icon={ArrowUp02Icon} />
              {t("move-up")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onClick={handleMoveDown}
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
              onClick={confirmDeleteHandlers.open}
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
