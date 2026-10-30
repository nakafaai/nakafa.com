import {
  Atom01Icon,
  Backpack01Icon,
  Book01Icon,
  Book02Icon,
  Book03Icon,
  BookOpen01Icon,
  CalculatorIcon,
  CompassIcon,
  Globe02Icon,
  MicroscopeIcon,
  Mortarboard01Icon,
  NotebookIcon,
  PencilIcon,
  RulerIcon,
} from "@hugeicons/core-free-icons";
import { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ColumnFilter } from "@/components/shared/table/column";
import { namedOptions } from "@/components/shared/table/filter";
import { gradeItems } from "@/components/tenant/settings/choices";
import { COHORT_STATUS_LOOKS } from "@/components/tenant/settings/cohort/status";

/** The icons of the school years in the grade column's filter, one of study for each year. */
const GRADE_ICONS = [
  Backpack01Icon,
  PencilIcon,
  Book01Icon,
  RulerIcon,
  NotebookIcon,
  CalculatorIcon,
  Book02Icon,
  CompassIcon,
  Globe02Icon,
  Book03Icon,
  Atom01Icon,
  MicroscopeIcon,
  BookOpen01Icon,
  Mortarboard01Icon,
] as const;

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
