import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Award01Icon,
  Calendar01Icon,
  Calendar02Icon,
  Calendar03Icon,
  Calendar04Icon,
  Certificate01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  MedalFirstPlaceIcon,
  MortarboardIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { KktpStatus } from "@repo/backend/confect/records/grade";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { Link } from "@/lib/routing/link";

/** One released grade of the viewer, as their grades page lists it. */
type OwnGrade = Ref.Returns<typeof records.grades.own>[number];

/** The look of each KKTP status, in its cell and in its column's filter: a met mark, and a note to look again. */
const KKTP_LOOKS = {
  notReached: { icon: InformationCircleIcon, tone: "warning" },
  reached: { icon: CheckmarkCircle02Icon, tone: "success" },
} as const satisfies Record<typeof KktpStatus.Type, StatusLook>;

/** The icons of the period and band filters, one for each value while the pool has one free. */
const PERIOD_ICONS = [
  Calendar03Icon,
  Calendar01Icon,
  Calendar02Icon,
  Calendar04Icon,
] as const;
const BAND_ICONS = [Award01Icon, MedalFirstPlaceIcon, StarIcon] as const;

/** The band filter's value of a grade whose scheme names no band for it. */
const NO_BAND = "none";

/** The columns of the grades table. */
const gradeColumns = tableColumns<OwnGrade>();

/**
 * The viewer's own released grades in the school, of every class and period, newest period first: a table that
 * finds a class, filters by period, band and KKTP status, and sorts by class and grade. The header's search stands
 * from the first paint, and the table waits for its rows, so no empty state shows before they arrive.
 */
export function SchoolOwnGrades() {
  const t = useTranslations("SchoolGrades");

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("own-title") }]} title={t("own-title")}>
        <TableSearch placeholder={t("own-search")} />
      </SchoolHeader>
      <TablePageBody>
        <OwnGradeTable />
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** The table of the viewer's grades, or the sentence of a viewer who has none released yet. */
function OwnGradeTable() {
  const t = useTranslations("SchoolGrades");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const grades = useQuery(records.grades.own, isSettled ? { slug } : "skip");
  if (QueryResult.isFailure(grades)) {
    throw grades.error;
  }
  const rows = QueryResult.isSuccess(grades) ? grades.value : [];

  const periods = Arr.dedupe(Arr.map(rows, (grade) => grade.period));
  const bands = Arr.dedupe(Arr.map(rows, (grade) => grade.band ?? NO_BAND));
  const columns = [
    gradeColumns.text((grade) => grade.className, {
      cell: (info) => (
        <TableTitle icon={MortarboardIcon}>
          <span dir="auto">{info.getValue()}</span>
        </TableTitle>
      ),
      header: t("own-class"),
      id: "class",
    }),
    gradeColumns.values((grade) => grade.period, {
      header: t("own-period"),
      id: "period",
      options: namedOptions(periods, PERIOD_ICONS),
    }),
    gradeColumns.number((grade) => grade.value, {
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      header: t("value"),
      id: "value",
    }),
    gradeColumns.values((grade) => grade.band ?? NO_BAND, {
      cell: (info) =>
        info.getValue() === NO_BAND ? null : <span>{info.getValue()}</span>,
      header: t("own-band"),
      id: "band",
      options: Arr.map(namedOptions(bands, BAND_ICONS), (option) =>
        option.value === NO_BAND
          ? { ...option, label: t("own-band-none") }
          : option
      ),
    }),
    gradeColumns.values((grade) => grade.kktp, {
      cell: (info) => (
        <TableStatus
          icon={KKTP_LOOKS[info.getValue()].icon}
          label={t(`kktp-${info.getValue()}`)}
          tone={KKTP_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("kktp"),
      id: "kktp",
      options: Arr.map(KktpStatus.literals, (kktp) => ({
        icon: KKTP_LOOKS[kktp].icon,
        label: t(`kktp-${kktp}`),
        value: kktp,
      })),
    }),
    gradeColumns.menu(() => (
      <div className="flex justify-end">
        <Button
          render={
            <Link params={{ slug }} to="/school/$slug/cards">
              <HugeIcons icon={Certificate01Icon} />
              {t("own-open-cards")}
            </Link>
          }
          size="sm"
          variant="outline"
        />
      </div>
    )),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      empty={
        <TableEmpty
          act="writing"
          description={t("own-empty-description")}
          title={t("own-empty")}
        />
      }
      loading={!QueryResult.isSuccess(grades)}
      rowId={(grade) => grade.id}
      search="class"
    />
  );
}
