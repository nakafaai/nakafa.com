import { ArrowRight01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { ServiceEmpty } from "@/components/connectors/detail";
import { holderOf } from "@/components/connectors/directory";
import { useService } from "@/components/connectors/service";
import { TableStatus } from "@/components/shared/table/status";
import { ClassroomCourses } from "@/components/tenant/connectors/classroom";
import { useTenant } from "@/components/tenant/context";
import { schoolExamsTarget } from "@/lib/routing/school/target";

/** The work a connection opens in a school, or Nina saying where the service stands while it opens none. */
export function SchoolServiceWork() {
  const { service, state } = useService();

  if (service.key === "classroom" && Option.contains(state, "connected")) {
    return <ClassroomCourses />;
  }

  return <ServiceEmpty />;
}

/**
 * Marks a service the viewer holds in person, the one thing the page does not already tell: a
 * school's own connection names no holder, because the page already stands in the school.
 */
export function SchoolHolder() {
  const t = useTranslations("Connectors");
  const { service } = useService();

  if (holderOf(service) !== "personal") {
    return null;
  }

  return (
    <TableStatus
      band
      icon={UserIcon}
      label={t("holder-personal")}
      tone="neutral"
    />
  );
}

/** The exams a connected Forms feeds, for a viewer who may open them. */
export function ServiceExams() {
  const t = useTranslations("Connectors");
  const { service, state } = useService();
  const { canOpenExams, slug } = useTenant();

  if (
    !(
      service.key === "forms" &&
      canOpenExams &&
      Option.contains(state, "connected")
    )
  ) {
    return null;
  }

  return (
    <Link {...schoolExamsTarget(slug)} className={buttonVariants()}>
      {t("open-exams")}
      <HugeIcons icon={ArrowRight01Icon} />
    </Link>
  );
}
