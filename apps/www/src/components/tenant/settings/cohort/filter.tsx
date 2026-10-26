import {
  Archive02Icon,
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
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { namedOptions } from "@/components/shared/table/filter";
import { TableFilter } from "@/components/shared/table/toolbar";
import { gradeItems } from "@/components/tenant/settings/choices";

/** The icons of the school years in the Filter menu, one of study for each year. */
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

/** The icon of each cohort status in the Filter menu: the class together, and an archive. */
const COHORT_STATUS_ICONS = {
  active: UserGroupIcon,
  archived: Archive02Icon,
} as const satisfies Record<typeof CohortStatus.Type, IconSvgElement>;

/** The cohorts' Filter menu, in the header row of the cohorts page: by school year and by status. */
export function CohortFilter() {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFilter
      facets={[
        {
          column: "grade",
          options: namedOptions(
            Arr.map(gradeItems, ({ value }) => value),
            GRADE_ICONS
          ),
          title: t("cohort-grade"),
        },
        {
          column: "status",
          options: Arr.map(CohortStatus.literals, (status) => ({
            icon: COHORT_STATUS_ICONS[status],
            label: t(`cohort-${status}`),
            value: status,
          })),
          title: t("cohort-status"),
        },
      ]}
    />
  );
}
