import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  useQuery,
} from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { GOOGLE_MANIFEST } from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr, Effect, Option } from "effect";
import { useConvexAuth } from "@/components/auth/convex";
import { ConnectorActionsContext } from "@/components/connectors/actions";
import { connectCallback } from "@/components/connectors/address";
import { ConnectorList } from "@/components/connectors/list";
import { disconnectOwnUpdate } from "@/components/connectors/optimistic";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/** How many of the account's connections the page reads. */
const CONNECTION_PAGE_SIZE = 20;

/**
 * The account's own Google connectors (journey J8): Drive and Calendar, which Nina
 * reads for this account alone. Connecting sends the browser to Google and back
 * to this page; disconnecting ends the connection at once.
 */
export function UserSettingsConnectors() {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const offered = useQuery(connectors.google.offered, isSettled ? {} : "skip");
  const connections = usePaginatedPreloaded(
    connectors.connections.listOwn,
    isSettled ? {} : "skip",
    { initialNumItems: CONNECTION_PAGE_SIZE },
    Option.none()
  );
  const start = useMutation(connectors.google.startPersonal);
  const disconnect = useMutation(connectors.connections.disconnectOwn);

  if (
    QueryResult.isFailure(offered) ||
    PaginatedQueryResult.isFailure(connections)
  ) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (
    !QueryResult.isSuccess(offered) ||
    connections._tag === "LoadingFirstPage"
  ) {
    return null;
  }

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
          offered.value,
          (connector) => GOOGLE_MANIFEST[connector].owner === "personal"
        )}
      />
    </ConnectorActionsContext>
  );
}
