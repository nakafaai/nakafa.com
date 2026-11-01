import { QueryResult, useQuery } from "@confect/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  PlayIcon,
  TaskEdit01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr } from "effect";
import { useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { RowItems, RowOpen } from "@/components/shared/table/menu";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
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
const sittingColumns = tableColumns<Sitting>();

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

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        <TableSearch placeholder={t("exams-search")} />
      </SchoolHeader>
      <TablePageBody>
        <StudentExamsTable />
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** The student's sittings in the School table, or the empty state while the student has none. */
function StudentExamsTable() {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const listed = useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");

  // A sitting the student submitted no longer needs the answers this device kept for it.
  useEffect(() => {
    if (QueryResult.isSuccess(listed)) {
      forgetSubmittedKept(listed.value);
    }
  }, [listed]);

  if (QueryResult.isFailure(listed)) {
    if (isLostAccess(listed.error)) {
      throw listed.error;
    }
    return <LoadFailure onRetry={reloadPage} />;
  }

  const columns = [
    sittingColumns.text((sitting) => sitting.examTitle, {
      cell: (info) => (
        <TableTitle
          icon={TaskEdit01Icon}
          tone={STATUS_LOOKS[sittingStatusOf(info.row.original)].tone}
        >
          <TargetLink
            className="underline-offset-4 hover:underline"
            dir="auto"
            target={schoolSittingTarget(slug, info.row.original.id)}
          >
            {info.getValue()}
          </TargetLink>
        </TableTitle>
      ),
      header: t("mine-exam"),
      id: "exam",
    }),
    sittingColumns.text((sitting) => sitting.room, {
      cell: (info) => <span dir="auto">{info.getValue()}</span>,
      header: t("room"),
      id: "room",
    }),
    sittingColumns.days((sitting) => sitting.opensAt, {
      cell: (info) =>
        schoolDayTimeText({
          at: info.getValue(),
          locale,
          timeZone: info.row.original.timeZone,
        }),
      header: t("mine-opens"),
      id: "opens",
      timeZone: (sitting) => sitting.timeZone,
    }),
    sittingColumns.values(sittingStatusOf, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`mine-${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("mine-status"),
      id: "status",
      options: Arr.map(SittingStatus.literals, (status) => ({
        icon: STATUS_LOOKS[status].icon,
        label: t(`mine-${status}`),
        value: status,
      })),
    }),
    sittingColumns.number((sitting) => sitting.score?.points ?? null, {
      cell: (info) => <SittingScore sitting={info.row.original} />,
      header: t("mine-score"),
      id: "score",
    }),
    sittingColumns.menu((info) => (
      <SittingAction sitting={info.row.original} />
    )),
  ];

  return (
    <DataTable
      columns={columns}
      data={QueryResult.isSuccess(listed) ? orderSittings(listed.value) : []}
      empty={
        <TableEmpty
          act="sleeping"
          description={t("mine-empty-description")}
          title={t("mine-empty")}
        />
      }
      loading={!QueryResult.isSuccess(listed)}
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
 * Continue once the student has one. Any other sitting offers Open, as its name does.
 */
function SittingAction({ sitting }: { readonly sitting: Sitting }) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");

  if (sittingStatusOf(sitting) !== "open") {
    return (
      <RowItems>
        <RowOpen icon={ViewIcon} label={tCommon("open")} />
      </RowItems>
    );
  }
  return (
    <RowItems>
      <RowOpen
        icon={PlayIcon}
        label={
          sitting.attempt === null ? t("student-start") : tCommon("continue")
        }
      />
    </RowItems>
  );
}
