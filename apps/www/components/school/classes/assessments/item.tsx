"use client";

import {
  ArrowDown02Icon,
  ArrowTurnForwardIcon,
  ArrowUp02Icon,
  Delete02Icon,
  Edit01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
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
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Activity, useTransition } from "react";
import { getAssessmentMode } from "@/components/school/classes/assessments/_data/mode";
import { getAssessmentStatus } from "@/components/school/classes/assessments/_data/status";
import { CreateAssessmentDialog } from "@/components/school/classes/assessments/create-dialog";
import type { Assessment } from "@/components/school/classes/assessments/types";
import { formatScheduledAt } from "@/components/school/classes/assessments/utils";
import { SchoolClassesDeleteDialog } from "@/components/school/classes/delete-dialog";
import { getLocale } from "@/lib/utils/date";

/** Return the badge variant used for one assessment status. */
function getBadgeVariant(
  status: Assessment["status"]
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

/** Render one assessment row using the same list pattern as materials. */
export function AssessmentCard({
  assessment,
  canManage,
}: {
  assessment: Assessment;
  canManage: boolean;
}) {
  const t = useTranslations("School.Classes");
  const locale = useLocale();
  const modeInfo = getAssessmentMode(assessment.mode);
  const statusInfo = getAssessmentStatus(assessment.status);

  return (
    <div className="group relative">
      <Activity mode={canManage ? "visible" : "hidden"}>
        <AssessmentActions
          assessment={assessment}
          className="absolute top-4 right-4 z-1"
        />
      </Activity>

      <div
        className={cn(
          "flex flex-col gap-3 p-4 transition-colors ease-out group-hover:bg-accent/20",
          canManage && "pr-14"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Activity mode={canManage ? "visible" : "hidden"}>
            <Badge
              className="w-fit"
              variant={getBadgeVariant(assessment.status)}
            >
              <HugeIcons className="size-3" icon={statusInfo.icon} />
              {assessment.status === "scheduled" && assessment.scheduledAt
                ? formatScheduledAt(assessment.scheduledAt, locale)
                : t(statusInfo.labelKey)}
            </Badge>
          </Activity>

          <Badge className="w-fit" variant="outline">
            <HugeIcons className="size-3" icon={modeInfo.icon} />
            {t(modeInfo.labelKey)}
          </Badge>
        </div>

        <div className="grid gap-1 text-left">
          <h3 className="min-w-0 truncate font-medium">{assessment.title}</h3>

          <div className="flex min-w-0 items-center gap-1 text-muted-foreground text-sm">
            <HugeIcons
              className="size-3 shrink-0"
              icon={ArrowTurnForwardIcon}
            />
            <p className="min-w-0 truncate">
              {assessment.description?.text ||
                t("assessment-empty-description")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <time className="min-w-0 truncate tracking-tight">
            {formatDistanceToNow(assessment.updatedAt, {
              addSuffix: true,
              locale: getLocale(locale),
            })}
          </time>
        </div>
      </div>
    </div>
  );
}

/** Render the management dropdown for one authored assessment. */
function AssessmentActions({
  assessment,
  className,
}: {
  assessment: Assessment;
  className?: string;
}) {
  const t = useTranslations("Common");
  const schoolT = useTranslations("School.Classes");
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteOpen, confirmDeleteHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const reorderAssessment = useMutation(
    api.assessments.mutations.public.reorder.reorderAssessment
  );
  const deleteAssessment = useMutation(
    api.assessments.mutations.public.delete.deleteAssessment
  );

  function handleMoveUp() {
    startTransition(async () => {
      await reorderAssessment({
        schoolId: assessment.schoolId,
        assessmentId: assessment._id,
        direction: "up",
      });
    });
  }

  function handleMoveDown() {
    startTransition(async () => {
      await reorderAssessment({
        schoolId: assessment.schoolId,
        assessmentId: assessment._id,
        direction: "down",
      });
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            await deleteAssessment({
              schoolId: assessment.schoolId,
              assessmentId: assessment._id,
            });
            toastManager.add({
              type: "success",
              title: schoolT("assessment-deleted"),
            });
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll(() =>
            Effect.sync(() => {
              toastManager.add({
                type: "error",
                title: schoolT("delete-assessment-failed"),
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
              className="z-1 opacity-50 transition-opacity ease-out group-hover:opacity-100"
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
            <MenuItem
              className="cursor-pointer"
              disabled={isPending}
              onClick={editHandlers.open}
            >
              <HugeIcons icon={Edit01Icon} />
              {t("edit")}
            </MenuItem>
            <MenuItem
              className="cursor-pointer"
              disabled={isPending}
              onClick={handleMoveUp}
            >
              <HugeIcons icon={ArrowUp02Icon} />
              {t("move-up")}
            </MenuItem>
            <MenuItem
              className="cursor-pointer"
              disabled={isPending}
              onClick={handleMoveDown}
            >
              <HugeIcons icon={ArrowDown02Icon} />
              {t("move-down")}
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup>
            <MenuItem
              className="cursor-pointer"
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

      <CreateAssessmentDialog
        initialAssessment={assessment}
        open={editOpen}
        setOpenAction={editHandlers.set}
      />

      <SchoolClassesDeleteDialog
        description={schoolT("delete-assessment-description")}
        isPending={isPending}
        onConfirmAction={handleDelete}
        open={confirmDeleteOpen}
        setOpenAction={confirmDeleteHandlers.set}
        title={schoolT("delete-assessment-title")}
      />
    </div>
  );
}
