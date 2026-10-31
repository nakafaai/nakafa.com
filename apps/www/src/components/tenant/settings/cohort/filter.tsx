import { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ColumnFilter } from "@/components/shared/table/column";
import { namedOptions } from "@/components/shared/table/filter";
import { GRADE_ICONS, gradeItems } from "@/components/tenant/settings/choices";
import { COHORT_STATUS_LOOKS } from "@/components/tenant/settings/cohort/status";

/** The head of the cohorts' grade column, which filters the cohorts by school year. */
export function CohortGradeFilter() {
  const t = useTranslations("SchoolSettings");

  return (
    <ColumnFilter
      column="grade"
      options={namedOptions(
        Arr.map(gradeItems, ({ value }) => value),
        GRADE_ICONS
      )}
      title={t("cohort-grade")}
    />
  );
}

/** The head of the cohorts' status column, which filters the cohorts by status. */
export function CohortStatusFilter() {
  const t = useTranslations("SchoolSettings");

  return (
    <ColumnFilter
      column="status"
      options={Arr.map(CohortStatus.literals, (status) => ({
        icon: COHORT_STATUS_LOOKS[status].icon,
        label: t(`cohort-${status}`),
        value: status,
      }))}
      title={t("cohort-status")}
    />
  );
}
