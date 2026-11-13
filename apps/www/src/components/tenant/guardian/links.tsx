import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  InboxIcon,
  Link01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { LinkStatus } from "@repo/backend/confect/guardians/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, useState } from "react";
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
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TablePageBody } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
  useServerSearch,
} from "@/components/shared/table/toolbar";
import { TableViews } from "@/components/shared/table/views";
import { EmptyState } from "@/components/state/empty";
import { LoadFailure } from "@/components/state/failure";
import { EmptyNina } from "@/components/state/nina";
import { WithAction } from "@/components/tenant/action";
import { useTenant } from "@/components/tenant/context";
import {
  GuardianLinkActions,
  GuardianLinkMenu,
  type LinkItem,
} from "@/components/tenant/guardian/link";
import { WaitingRequests } from "@/components/tenant/guardian/requests";
import { GuardianLinkStartDialog } from "@/components/tenant/guardian/start";
import { LINK_STATUS_LOOKS } from "@/components/tenant/guardian/status";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";
import { isDraft } from "@/components/tenant/settings/state";
import { SchoolDateTime } from "@/components/tenant/settings/time";
import { useKeptRows } from "@/lib/data/kept";

/** How many links one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The columns of the links table. */
const linkColumns = tableColumns<LinkItem>();

/** The links loaded so far, which the table lists and the open link is found in. */
const LinksContext = createContext<readonly LinkItem[] | null>(null);

/** Reads the links loaded so far. */
function useLinks() {
  return useRequired(LinksContext, "useLinks");
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
        <SchoolSettingsHeader>
          <TableSearch placeholder={t("links-search")} />
          <WithAction action="guardian.link">
            <Button onClick={() => setIsStarting(true)} type="button">
              <HugeIcons icon={Link01Icon} />
              <span className="@max-sm/header:sr-only">{t("link-add")}</span>
            </Button>
          </WithAction>
        </SchoolSettingsHeader>
        <ReadBoundary
          fallback={(failure) => <TablePageBody>{failure}</TablePageBody>}
        >
          <GuardianLinksBody />
        </ReadBoundary>
        <GuardianLinkStartDialog open={isStarting} setOpen={setIsStarting} />
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/**
 * The links of the school, read a page at a time, in the one card of a settings table: the
 * table, which loads more rows as its end comes into view, beside the open link; or the empty
 * state while the school has no link. While a parent's request waits, Links and Requests views
 * stand above the card, and Requests fills it with the waiting requests. The card stands from
 * the first frame.
 */
function GuardianLinksBody() {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const search = useServerSearch();
  const pagination = usePaginatedQuery(
    guardians.links.list,
    isSettled ? { slug, ...(search === "" ? {} : { search }) } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  // A new search's first page loads behind the rows the table shows, so the table never blanks.
  const kept = useKeptRows(
    pagination._tag === "LoadingFirstPage",
    pagination.results
  );
  const waiting = usePaginatedQuery(
    guardians.requests.waiting,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(waiting)) {
    throw waiting.error;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  // Both reads arrive before the list draws, so a waiting request never pushes the table down.
  if (Option.isNone(kept) || PaginatedQueryResult.isLoadingFirstPage(waiting)) {
    return (
      <LinksFrame links={[]}>
        <TablePageBody>{null}</TablePageBody>
      </LinksFrame>
    );
  }
  if (Arr.isReadonlyArrayEmpty(kept.value) && search === "") {
    return (
      <LinksFrame links={kept.value}>
        <TablePageBody>
          {failed ? (
            <LoadFailure onRetry={reloadPage} />
          ) : (
            <EmptyState
              description={t("links-empty-description")}
              scene={<EmptyNina act="typing" />}
              title={t("links-empty")}
            />
          )}
        </TablePageBody>
      </LinksFrame>
    );
  }

  return (
    <LinksFrame links={kept.value}>
      <LinkViews
        requests={<WaitingList />}
        waits={!Arr.isReadonlyArrayEmpty(waiting.results)}
      >
        {failed ? <DataFailure onRetry={reloadPage} /> : null}
        <GuardianLinkTable />
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </LinkViews>
    </LinksFrame>
  );
}

/**
 * The one card of the links page, under the Links and Requests views while a parent's request waits: the links the
 * caller composes, or the waiting requests (`requests`). The views stand only while a request waits, so the last
 * answer takes them away and brings the links back.
 */
function LinkViews({
  children,
  requests,
  waits,
}: {
  children: ReactNode;
  /** The waiting requests, which the Requests view shows in the links' place. */
  requests: ReactNode;
  /** Whether a parent's request waits for an answer. */
  waits: boolean;
}) {
  const t = useTranslations("SchoolGuardians");
  const [view, setView] = useState<"links" | "requests">("links");
  const shown = waits ? view : "links";

  return (
    <TablePageBody
      views={
        waits ? (
          <TableViews
            label={t("links-views")}
            onChoose={setView}
            view={shown}
            views={[
              {
                icon: UserMultipleIcon,
                label: t("view-links"),
                value: "links",
              },
              {
                icon: InboxIcon,
                label: t("view-requests"),
                value: "requests",
              },
            ]}
          />
        ) : null
      }
    >
      {shown === "requests" ? requests : children}
    </TablePageBody>
  );
}

/** The waiting requests, read a page at a time, the next page loading as the table's end comes into view. */
function WaitingList() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const waiting = usePaginatedQuery(
    guardians.requests.waiting,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  return (
    <>
      <WaitingRequests requests={waiting.results} />
      {PaginatedQueryResult.isCanLoadMore(waiting) ? (
        <Intersection onIntersect={() => waiting.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * The list's pane of the links page, beside the open link, around the one card of a settings table that the caller
 * composes: the links it holds are the ones the table lists and the open link is found in.
 */
function LinksFrame({
  children,
  links,
}: {
  children: ReactNode;
  links: readonly LinkItem[];
}) {
  const t = useTranslations("SchoolGuardians");

  return (
    <LinksContext value={links}>
      <Panes id="links">
        <PanesList>{children}</PanesList>
        <PanesDetail label={t("link-detail")}>
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

/**
 * The links in a data table: the student, the parent's name, the state, and the row menu. The open link shows the
 * parent's address, so these columns all fit beside it on a laptop.
 */
function GuardianLinkTable() {
  const t = useTranslations("SchoolGuardians");
  const links = useLinks();
  const statusText = useStatusText();

  const columns = [
    linkColumns.text((link) => link.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.id}>{info.getValue()}</PaneOpen>
      ),
      header: t("student"),
      id: "student",
    }),
    linkColumns.text((link) => link.guardian.name, {
      header: t("guardian-name"),
      id: "guardian",
    }),
    linkColumns.text((link) => link.email, {
      header: t("guardian-email"),
      id: "email",
    }),
    linkColumns.values((link) => link.status, {
      cell: (info) => (
        <TableStatus
          icon={LINK_STATUS_LOOKS[info.getValue()].icon}
          label={statusText(info.row.original)}
          tone={LINK_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("status"),
      id: "status",
      options: Arr.map(LinkStatus.literals, (status) => ({
        icon: LINK_STATUS_LOOKS[status].icon,
        label: t(`status-${status}`),
        value: status,
      })),
    }),
    linkColumns.menu(
      (info) => (
        <WithAction
          action="guardian.link"
          otherwise={<RowCopy value={info.row.original.student.name} />}
        >
          <GuardianLinkMenu link={info.row.original} />
        </WithAction>
      ),
      { inert: (row) => isDraft(row.id) }
    ),
  ];

  return <DataTable columns={columns} data={links} rowId={(link) => link.id} />;
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
