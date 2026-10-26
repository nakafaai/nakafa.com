import { StudentIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { TableFilter } from "@/components/shared/table/toolbar";
import { gradeItems } from "@/components/tenant/settings/choices";

/** The cohorts' Filter menu, in the header row of the cohorts page: by school year and by status. */
export function CohortFilter() {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFilter
      facets={[
        {
          column: "grade",
          icon: StudentIcon,
          options: gradeItems,
          title: t("cohort-grade"),
        },
        {
          column: "status",
          icon: UserGroupIcon,
          options: Arr.map(CohortStatus.literals, (status) => ({
            label: t(`cohort-${status}`),
            value: status,
          })),
          title: t("cohort-status"),
        },
      ]}
    />
  );
}
