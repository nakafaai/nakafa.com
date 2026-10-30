import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { Link01Icon } from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { LinkStatus } from "@repo/backend/confect/guardians/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
  PaneOpen,
} from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import {
  GuardianLinkActions,
  GuardianLinkMenu,
  type LinkItem,
} from "@/components/tenant/guardian/link";
import { GuardianLinkStartDialog } from "@/components/tenant/guardian/start";
import { LINK_STATUS_LOOKS } from "@/components/tenant/guardian/status";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { SchoolDateTime } from "@/components/tenant/settings/time";

/** How many links one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The columns of the links table. */
const linkColumns = createColumnHelper<typeof dataTableFeatures, LinkItem>();

/** The links loaded so far, which the table lists and the open link is found in. */
const LinksContext = createContext<readonly LinkItem[] | null>(null);

/** Reads the links loaded so far. */
function useLinks() {
  const links = use(LinksContext);
  if (links === null) {
    throw new Error("useLinks must be used within GuardianLinksBody");
  }
  return links;
}

/**
 * The guardian links of the school (ADR 0034). The header holds the search by student, the
 * status filter and Link a parent. The body is the links table, and the link a press opens
 * stands beside it on a wide screen and in a sheet on a phone: the parent, the address, the
 * state, and its actions. A link that the roster cannot check by NISN is checked by hand, and
 * any live link can be ended, from its row menu or from the open link.
 */
export function GuardianLinksSettings() {
  const t = useTranslations("SchoolGuardians");
  const [isStarting, setIsStarting] = useState(false);

  return (
    <TableFiltersProvider>
      <PanesProvider>
        <SettingsTablePage
          actions={
            <>
              <TableSearch placeholder={t("links-search")} />
              <Button onClick={() => setIsStarting(true)} type="button">
                <HugeIcons icon={Link01Icon} />
                {t("link-add")}
              </Button>
            </>
          }
        >
          <ReadBoundary>
            <GuardianLinksBody />
          </ReadBoundary>
          <GuardianLinkStartDialog open={isStarting} setOpen={setIsStarting} />
        </SettingsTablePage>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/**
 * The links of the school, read a page at a time: the table, which loads more rows as its end
 * comes into view, beside the open link; or the empty state while the school has no link.
 */
function GuardianLinksBody() {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    guardians.links.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <DataFailure onRetry={reloadPage} />;
    }
    return (
      <TableEmpty
        act="typing"
        description={t("links-empty-description")}
        title={t("links-empty")}
      />
    );
  }

  return (
    <LinksContext value={pagination.results}>
      <Panes>
        <PanesList>
          {failed ? <DataFailure onRetry={reloadPage} /> : null}
          <GuardianLinkTable />
          {PaginatedQueryResult.isCanLoadMore(pagination) ? (
            <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
          ) : null}
        </PanesList>
        <PanesDetail empty={t("link-detail-empty")} label={t("link-detail")}>
          <GuardianLinkDetail />
        </PanesDetail>
      </Panes>
    </LinksContext>
  );
}

/** The state of a link as staff read it: a pending link whose NISN checks failed says so. */
function useStatusText() {
  const t = useTranslations("SchoolGuardians");

  return (link: LinkItem) =>
    link.status === "pending" && link.mismatches > 0
      ? t("status-mismatch")
      : t(`status-${link.status}`);
}

/** The links in a data table: the student, the parent's address, the state, and the row menu. */
function GuardianLinkTable() {
  const t = useTranslations("SchoolGuardians");
  const links = useLinks();
  const statusText = useStatusText();

  const columns = linkColumns.columns([
    linkColumns.accessor((link) => link.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.id}>{info.getValue()}</PaneOpen>
      ),
      filterFn: "includesString",
      header: t("student"),
      id: "student",
      sortFn: "text",
    }),
    linkColumns.accessor((link) => link.email, {
      header: t("email-label"),
      id: "email",
      sortFn: "text",
    }),
    linkColumns.accessor((link) => link.status, {
      cell: (info) => (
        <TableStatus
          icon={LINK_STATUS_LOOKS[info.getValue()].icon}
          label={statusText(info.row.original)}
          tone={LINK_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(LinkStatus.literals, (status) => ({
            icon: LINK_STATUS_LOOKS[status].icon,
            label: t(`status-${status}`),
            value: status,
          }))}
          title={t("status")}
        />
      ),
      id: "status",
      meta: { align: "center" },
    }),
    linkColumns.display({
      cell: (info) => <GuardianLinkMenu link={info.row.original} />,
      id: "actions",
      meta: { align: "end" },
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={links}
      rowId={(link) => link.id}
      search="student"
    />
  );
}

/**
 * The open link: the student, the parent's name and address, the state, when a pending link
 * expires, and how many NISN checks failed; then the link's actions in the footer. A link the
 * list no longer holds closes.
 */
function GuardianLinkDetail() {
  const t = useTranslations("SchoolGuardians");
  const links = useLinks();
  const statusText = useStatusText();
  const open = usePanes((state) => state.open);
  const link = Option.flatMap(open, (id) =>
    Arr.findFirst(links, (candidate) => candidate.id === id)
  );

  return Option.match(link, {
    onNone: () => null,
    onSome: (found) => (
      <>
        <PaneHeader
          description={found.guardian.name}
          title={found.student.name}
        />
        <PaneBody>
          <PaneFacts>
            <PaneFact label={t("guardian-name")}>
              {found.guardian.name}
            </PaneFact>
            <PaneFact label={t("email-label")}>
              <span className="break-all">{found.email}</span>
            </PaneFact>
            <PaneFact label={t("status")}>
              <TableStatus
                icon={LINK_STATUS_LOOKS[found.status].icon}
                label={statusText(found)}
                tone={LINK_STATUS_LOOKS[found.status].tone}
              />
            </PaneFact>
            {found.status === "pending" ? (
              <PaneFact label={t("expires")}>
                <SchoolDateTime at={found.expiresAt} />
              </PaneFact>
            ) : null}
            {found.mismatches > 0 ? (
              <PaneFact label={t("mismatches")}>{found.mismatches}</PaneFact>
            ) : null}
          </PaneFacts>
        </PaneBody>
        {found.status === "pending" || found.status === "verified" ? (
          <PaneFooter>
            <GuardianLinkActions link={found} />
          </PaneFooter>
        ) : null}
      </>
    ),
  });
}
