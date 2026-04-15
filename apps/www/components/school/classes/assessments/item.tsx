"use client";

import {
  ArrowDown02Icon,
  ArrowTurnForwardIcon,
  ArrowUp02Icon,
  Delete02Icon,
  Edit01Icon,
  File02Icon,
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
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Activity, useState, useTransition } from "react";
import { toast } from "sonner";
import { getAssessmentStatus } from "@/components/school/classes/assessments/_data/status";
import { CreateAssessmentDialog } from "@/components/school/classes/assessments/create-dialog";
import type { Assessment } from "@/components/school/classes/assessments/types";
import { formatScheduledAt } from "@/components/school/classes/assessments/utils";
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
      return "muted";
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
            <HugeIcons className="size-3" icon={File02Icon} />
            {t(`assessment-mode-${assessment.mode}`)}
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
  const [editOpen, setEditOpen] = useState(false);
  const reorderAssessment = useMutation(
    api.assessments.mutations.public.reorder.reorderAssessment
  );
  const archiveAssessment = useMutation(
    api.assessments.mutations.public.archive.archiveAssessment
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

  function handleArchive() {
    startTransition(async () => {
      await archiveAssessment({
        schoolId: assessment.schoolId,
        assessmentId: assessment._id,
      });
      toast.success(schoolT("assessment-archived"));
    });
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="z-1 opacity-50 transition-opacity ease-out group-hover:opacity-100"
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
              onSelect={handleArchive}
              variant="destructive"
            >
              <HugeIcons icon={Delete02Icon} />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateAssessmentDialog
        initialAssessment={assessment}
        open={editOpen}
        setOpenAction={setEditOpen}
      />
    </div>
  );
}
