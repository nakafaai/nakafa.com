import { QueryResult, useQuery } from "@confect/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { schoolDayTimeText } from "@/components/tenant/settings/clock";
import {
  orderSittings,
  SittingStatus,
  sittingStatusOf,
} from "@/components/tenant/sittings";
import { TargetLink } from "@/lib/routing/link";
import { schoolSittingTarget } from "@/lib/routing/school/target";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof StudentSittingRow.Type;

/** The columns of the student's exams table. */
const sittingColumns = createColumnHelper<typeof dataTableFeatures, Sitting>();

/** The look of each status of a sitting: open to enter now, still to open, and finished. */
const STATUS_LOOKS = {
  finished: { icon: CheckmarkCircle02Icon, tone: "neutral" },
  open: { icon: PlayIcon, tone: "success" },
  upcoming: { icon: Clock01Icon, tone: "info" },
} as const satisfies Record<typeof SittingStatus.Type, StatusLook>;

/**
 * The student's own exams, the page a student's school opens on: every sitting the student may take part in, the open
 * ones first, then those still to open, then the finished ones with the student's score once the teacher releases it.
 * A sitting's name opens it. The list reads once the session settles; until then nothing stands below the header, and
 * a failed read is shown where the table would be.
 */
export function StudentExams() {
  const t = useTranslations("Exams");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const listed = useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");

  // A sitting the student submitted no longer needs the answers this device kept for it.
  useEffect(() => {
    if (QueryResult.isSuccess(listed)) {
      forgetSubmittedKept(listed.value);
    }
  }, [listed]);

  if (QueryResult.isFailure(listed) && isLostAccess(listed.error)) {
    throw listed.error;
  }
  const sittings = QueryResult.isSuccess(listed)
    ? orderSittings(listed.value)
    : null;

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {sittings !== null && Arr.isReadonlyArrayNonEmpty(sittings) ? (
          <TableSearch placeholder={t("exams-search")} />
        ) : null}
      </SchoolHeader>
      <TablePageBody>
        {QueryResult.isFailure(listed) ? (
          <DataFailure onRetry={reloadPage} />
        ) : null}
        {sittings === null ? null : <StudentExamsTable sittings={sittings} />}
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** The student's sittings in the School table, or the empty state while the student has none. */
function StudentExamsTable({
  sittings,
}: {
  readonly sittings: readonly Sitting[];
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const { slug } = useTenant();

  if (Arr.isReadonlyArrayEmpty(sittings)) {
    return (
      <TableEmpty
        act="sleeping"
        description={t("mine-empty-description")}
        title={t("mine-empty")}
      />
    );
  }

  const columns = sittingColumns.columns([
    sittingColumns.accessor((sitting) => sitting.examTitle, {
      cell: (info) => (
        <TargetLink
          className="font-medium underline-offset-4 hover:underline"
          dir="auto"
          target={schoolSittingTarget(slug, info.row.original.id)}
        >
          {info.getValue()}
        </TargetLink>
      ),
      filterFn: "includesString",
      header: t("mine-exam"),
      id: "exam",
      sortFn: "text",
    }),
    sittingColumns.accessor((sitting) => sitting.room, {
      cell: (info) => <span dir="auto">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("room"),
      id: "room",
      sortFn: "text",
    }),
    sittingColumns.accessor((sitting) => sitting.opensAt, {
      cell: (info) =>
        schoolDayTimeText({
          at: info.getValue(),
          locale,
          timeZone: info.row.original.timeZone,
        }),
      header: t("mine-opens"),
      id: "opens",
      sortFn: "basic",
    }),
    sittingColumns.accessor(sittingStatusOf, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`mine-${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(SittingStatus.literals, (status) => ({
            icon: STATUS_LOOKS[status].icon,
            label: t(`mine-${status}`),
            value: status,
          }))}
          title={t("mine-status")}
        />
      ),
      id: "status",
    }),
    sittingColumns.display({
      cell: (info) => <SittingScore sitting={info.row.original} />,
      header: t("mine-score"),
      id: "score",
    }),
    sittingColumns.display({
      cell: (info) => <SittingAction sitting={info.row.original} />,
      id: "action",
      // A student on a phone reaches Start at the row's edge, with the table scrolled anywhere.
      meta: { align: "menu" },
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={sittings}
      rowId={(sitting) => sitting.id}
      search="exam"
    />
  );
}

/** A finished sitting's score once the teacher releases it, and a muted word while it waits; nothing before. */
function SittingScore({ sitting }: { readonly sitting: Sitting }) {
  const t = useTranslations("Exams");

  if (sitting.score !== null) {
    return t("student-score", {
      points: sitting.score.points,
      total: sitting.score.total,
    });
  }
  if (sittingStatusOf(sitting) !== "finished") {
    return null;
  }
  return (
    <span className="text-muted-foreground">{t("mine-score-waiting")}</span>
  );
}

/**
 * The action of a sitting open now that the student has not finished: Start before the student has an attempt, and
 * Continue once the student has one. Any other sitting has no action, and its name still opens it.
 */
function SittingAction({ sitting }: { readonly sitting: Sitting }) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const { slug } = useTenant();

  if (sittingStatusOf(sitting) !== "open") {
    return null;
  }
  return (
    <TargetLink
      className={buttonVariants({ size: "sm" })}
      target={schoolSittingTarget(slug, sitting.id)}
    >
      {sitting.attempt === null ? t("student-start") : tCommon("continue")}
    </TargetLink>
  );
}
