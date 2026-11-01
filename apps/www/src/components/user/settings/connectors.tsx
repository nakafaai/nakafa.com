import { PaginatedQueryResult, QueryResult, useMutation } from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { Effect, Option } from "effect";
import { type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  ConnectOutcomeContext,
  ConnectorActionsContext,
} from "@/components/connectors/actions";
import { connectCallback } from "@/components/connectors/address";
import {
  ServiceActions,
  ServiceDetail,
  ServiceHeader,
  ServiceIdle,
  ServiceStatus,
} from "@/components/connectors/detail";
import {
  ACCOUNT_SERVICES,
  directoryEntries,
} from "@/components/connectors/directory";
import { ServiceFilter } from "@/components/connectors/filter";
import { LibraryControls, ServiceList } from "@/components/connectors/library";
import {
  CONNECTION_PAGE_SIZE,
  type Connection,
  disconnectOwnUpdate,
} from "@/components/connectors/optimistic";
import { PaneBody, PaneFooter } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { UserSettingsHeader } from "@/components/user/settings/header";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The account's own Google connectors (journey J8) as the library a school shows: one header with
 * the search and the filter, the services in cards, and a press on one opens its detail beside them,
 * or in a sheet on a small screen. Nina reads Drive and Calendar for this account alone.
 */
export function UserSettingsConnectors({ children }: { children: ReactNode }) {
  return (
    <TableFiltersProvider>
      <PanesProvider wideFrom="lg">
        <UserSettingsHeader>
          <LibraryControls>
            <ServiceFilter services={ACCOUNT_SERVICES} />
          </LibraryControls>
        </UserSettingsHeader>
        {children}
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/**
 * The services of the account. Connecting sends the browser to Google and back to this page, and
 * disconnecting ends the connection at once.
 */
export function AccountDirectory({
  first,
  initialOffered,
}: {
  first: PreloadedPage<Connection>;
  initialOffered: readonly GoogleConnector[];
}) {
  const t = useTranslations("Connectors");
  const tried = use(ConnectOutcomeContext);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const live = usePreloadedQueryResult(
    connectors.google.offered,
    isSettled ? {} : "skip",
    initialOffered
  );
  const connections = usePaginatedPreloaded(
    connectors.connections.listOwn,
    isSettled ? {} : "skip",
    { initialNumItems: CONNECTION_PAGE_SIZE },
    Option.some(first)
  );
  const start = useMutation(connectors.google.startPersonal);
  const disconnect = useMutation(connectors.connections.disconnectOwn);

  if (
    QueryResult.isFailure(live) ||
    PaginatedQueryResult.isFailure(connections)
  ) {
    return <LoadFailure onRetry={reloadPage} />;
  }
  const entries = directoryEntries({
    hasRead: true,
    held: { own: connections.results, school: [] },
    mayConnectSchool: false,
    offered: QueryResult.isSuccess(live) ? live.value : initialOffered,
    services: ACCOUNT_SERVICES,
    tried,
  });

  return (
    <ConnectorActionsContext
      value={{
        connect: (connector) =>
          runForumCall(
            forumCall(() =>
              start({
                connector,
                redirectUri: connectCallback(window.location, null),
                returnPath: window.location.pathname,
              })
            ).pipe(
              Effect.tap(({ url }) =>
                Effect.sync(() => window.location.assign(url))
              )
            ),
            toastForumFailure
          ),
        disconnect: (connection) =>
          runForumCall(
            forumCall(() =>
              disconnect.withOptimisticUpdate(disconnectOwnUpdate)({
                connectionId: connection.id,
              })
            ),
            toastForumFailure
          ),
      }}
    >
      <Panes>
        <PanesList>
          <ServiceList entries={entries} />
        </PanesList>
        <PanesDetail label={t("detail")}>
          <ServiceDetail entries={entries}>
            <ServiceHeader />
            <PaneBody>
              <ServiceIdle />
            </PaneBody>
            <PaneFooter>
              <ServiceStatus />
              <ServiceActions />
            </PaneFooter>
          </ServiceDetail>
        </PanesDetail>
      </Panes>
    </ConnectorActionsContext>
  );
}
