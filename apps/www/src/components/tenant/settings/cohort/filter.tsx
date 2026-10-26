import { StudentIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import {
  COHORT_GRADE_MAX,
  COHORT_GRADE_MIN,
  CohortStatus,
} from "@repo/backend/confect/tenancy/cohort";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { TableFilter } from "@/components/shared/table/toolbar";

/** The school years a cohort may hold, as the grade choices of its dialog and of its filter. */
export const gradeItems = Arr.makeBy(
  COHORT_GRADE_MAX - COHORT_GRADE_MIN + 1,
  (index) => {
    const grade = String(COHORT_GRADE_MIN + index);
    return { label: grade, value: grade };
  }
);

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
