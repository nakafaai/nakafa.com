import { PaginatedQueryResult, QueryResult, useMutation } from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import {
  GOOGLE_MANIFEST,
  type GoogleConnector,
} from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr, Effect, Option } from "effect";
import { useConvexAuth } from "@/components/auth/convex";
import { ConnectorActionsContext } from "@/components/connectors/actions";
import { connectCallback } from "@/components/connectors/address";
import { ConnectorList } from "@/components/connectors/list";
import {
  CONNECTION_PAGE_SIZE,
  type Connection,
  disconnectOwnUpdate,
} from "@/components/connectors/optimistic";
import { reloadPage } from "@/components/shared/reload";
import { LoadFailure } from "@/components/state/failure";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The account's own Google connectors (journey J8): Drive and Calendar, which Nina
 * reads for this account alone. Connecting sends the browser to Google and back
 * to this page; disconnecting ends the connection at once.
 */
export function UserSettingsConnectors({
  first,
  initialOffered,
}: {
  first: PreloadedPage<Connection>;
  initialOffered: readonly GoogleConnector[];
}) {
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
  const offered = QueryResult.isSuccess(live) ? live.value : initialOffered;

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
      <ConnectorList
        connections={connections.results}
        offered={Arr.filter(
          offered,
          (connector) => GOOGLE_MANIFEST[connector].owner === "personal"
        )}
      />
    </ConnectorActionsContext>
  );
}
