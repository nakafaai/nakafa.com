import {
  type PaginatedQueryItem,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { TableText } from "@/components/shared/table/text";
import { TableName } from "@/components/shared/table/title";
import { SchoolPlacementMove } from "@/components/tenant/settings/placement";
import type { Cohort, Period } from "@/components/tenant/settings/state";

/** How many students one page of the members table loads, and each page after it. */
const PAGE_SIZE = 25;

/** One student as the members table shows them. */
type MemberItem = PaginatedQueryItem<typeof tenancy.cohorts.members>;

/** The columns of the members table. */
const memberColumns = tableColumns<MemberItem>();

/**
 * Renders the students placed in one cohort in a data table that finds a name, with each
 * student's row menu. The table loads more students as its end comes into view, waits for
 * its first page, and shows an empty state while the cohort holds no student. An archived
 * cohort, or one with no other active cohort to move to, shows no row menu.
 */
export function SchoolCohortMembers({
  cohortId,
  isArchived,
  periodId,
  slug,
}: {
  cohortId: Cohort["id"];
  isArchived: boolean;
  periodId: Period["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    tenancy.cohorts.members,
    isSettled ? { cohortId, slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const cohorts = useQuery(
    tenancy.cohorts.list,
    isSettled ? { periodId, slug } : "skip"
  );

  const targets = QueryResult.isSuccess(cohorts)
    ? Arr.filter(
        cohorts.value,
        (cohort) => cohort.id !== cohortId && cohort.status === "active"
      )
    : [];
  const canMove = !isArchived && Arr.isReadonlyArrayNonEmpty(targets);
  const columns = [
    memberColumns.text((member) => member.name, {
      cell: (info) => <TableName>{info.getValue()}</TableName>,
      header: t("member-name"),
      id: "name",
    }),
    memberColumns.text((member) => member.email ?? "", {
      cell: (info) => <TableText>{info.getValue()}</TableText>,
      header: t("member-email"),
      id: "email",
    }),
    memberColumns.text((member) => member.login ?? "", {
      header: t("member-login"),
      id: "login",
    }),
    memberColumns.menu((info) =>
      canMove ? (
        <SchoolPlacementMove
          cohortId={cohortId}
          member={info.row.original}
          slug={slug}
          targets={targets}
        />
      ) : (
        <RowCopy value={info.row.original.name} />
      )
    ),
  ];

  return (
    <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
      <DataTable
        columns={columns}
        data={pagination.results}
        empty={
          <TableEmpty
            act="reading"
            description={t("cohort-members-description")}
            title={t("cohort-members-empty")}
          />
        }
        rowId={(member) => member.id}
        search="name"
      />
    </TablePages>
  );
}
