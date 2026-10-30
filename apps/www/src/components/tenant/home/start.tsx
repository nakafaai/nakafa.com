import {
  Certificate01Icon,
  Settings01Icon,
  TaskEdit01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { TargetLink } from "@/lib/routing/link";
import {
  schoolExamsTarget,
  schoolMembersTarget,
  schoolReportsTarget,
  schoolSettingsTarget,
} from "@/lib/routing/school/target";

/** A shortcut of the home: a card that opens one part of the school, lit while a pointer rests on it. */
const startTile = cva(
  "group flex min-w-0 items-start gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
);

/**
 * The parts of the school that the viewer may open, as a row of shortcuts at the top of the home, so a teacher, a
 * principal or an Admin starts from what the school holds rather than from one list: the exams for a viewer who may
 * open them, the report cards for a viewer who may open them, and the members and the settings for a viewer who
 * manages the school. A viewer who may open none of them, such as a student, sees no row.
 */
export function HomeStart() {
  const t = useTranslations("School");
  const { canManage, canOpenExams, canOpenReports } = useTenant();

  if (!(canManage || canOpenExams || canOpenReports)) {
    return null;
  }
  return (
    <nav
      aria-label={t("start-label")}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {canOpenExams ? <ExamsTile /> : null}
      {canOpenReports ? <ReportsTile /> : null}
      {canManage ? <MembersTile /> : null}
      {canManage ? <SettingsTile /> : null}
    </nav>
  );
}

/** The shortcut to the school's exams. */
function ExamsTile() {
  const t = useTranslations("School");
  const tExams = useTranslations("Exams");
  const { slug } = useTenant();

  return (
    <TargetLink className={startTile()} target={schoolExamsTarget(slug)}>
      <StartTileText
        description={t("start-exams")}
        icon={TaskEdit01Icon}
        title={tExams("title")}
      />
    </TargetLink>
  );
}

/** The shortcut to the school's report cards. */
function ReportsTile() {
  const t = useTranslations("School");
  const tReports = useTranslations("SchoolReports");
  const { slug } = useTenant();

  return (
    <TargetLink className={startTile()} target={schoolReportsTarget(slug)}>
      <StartTileText
        description={t("start-reports")}
        icon={Certificate01Icon}
        title={tReports("title")}
      />
    </TargetLink>
  );
}

/** The shortcut to the school's members. */
function MembersTile() {
  const t = useTranslations("School");
  const tSettings = useTranslations("SchoolSettings");
  const { slug } = useTenant();

  return (
    <TargetLink className={startTile()} target={schoolMembersTarget(slug)}>
      <StartTileText
        description={t("start-members")}
        icon={UserGroupIcon}
        title={tSettings("members")}
      />
    </TargetLink>
  );
}

/** The shortcut to the school's settings. */
function SettingsTile() {
  const t = useTranslations("School");
  const tSettings = useTranslations("SchoolSettings");
  const { slug } = useTenant();

  return (
    <TargetLink className={startTile()} target={schoolSettingsTarget(slug)}>
      <StartTileText
        description={t("start-settings")}
        icon={Settings01Icon}
        title={tSettings("manage-settings")}
      />
    </TargetLink>
  );
}

/** A shortcut's icon, its name, and what the part of the school is for, in one sentence. */
function StartTileText({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  title: string;
}) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <HugeIcons className="size-5" icon={icon} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-sm group-hover:text-accent-foreground">
          {description}
        </span>
      </span>
    </>
  );
}
