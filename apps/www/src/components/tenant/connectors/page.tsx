import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { GOOGLE_MANIFEST } from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr, Effect, Option } from "effect";
import { useConvexAuth } from "@/components/auth/convex";
import { ConnectorActionsContext } from "@/components/connectors/actions";
import { connectCallback } from "@/components/connectors/address";
import { ConnectorList } from "@/components/connectors/list";
import {
  currentConnection,
  disconnectSchoolUpdate,
} from "@/components/connectors/optimistic";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ClassroomImport } from "@/components/tenant/connectors/classroom";
import { useTenant } from "@/components/tenant/context";
import { isLostAccess } from "@/components/tenant/refusal";
import { SettingsPage } from "@/components/tenant/settings/section";

/** How many of the school's connections the page reads. */
const CONNECTION_PAGE_SIZE = 20;

/** The page of the school's connections that a connect returns to. */
const RETURN_PATH = "/settings/connections";

/** The school's connections as a settings page: the school header and the connectors. */
export function SchoolConnectionsSettings() {
  return (
    <SettingsPage>
      <SchoolConnections />
    </SettingsPage>
  );
}

/**
 * The school's Google connections (journey J7): Classroom, which a teacher or an
 * Admin connects with their own Google account so the school can import its
 * classes. Connecting sends the browser to Google at the site's own callback and
 * back to this page on the school's host.
 */
function SchoolConnections() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const offered = useQuery(connectors.google.offered, isSettled ? {} : "skip");
  const connections = usePaginatedQuery(
    connectors.connections.listSchool,
    isSettled ? { slug } : "skip",
    { initialNumItems: CONNECTION_PAGE_SIZE }
  );
  const start = useMutation(connectors.google.startSchool);
  const disconnect = useMutation(connectors.connections.disconnectSchool);

  if (
    PaginatedQueryResult.isFailure(connections) &&
    isLostAccess(connections.error)
  ) {
    throw connections.error;
  }
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

  const classroom = currentConnection(connections.results, "classroom");

  return (
    <div className="flex flex-col gap-6">
      <ConnectorActionsContext
        value={{
          connect: (connector) =>
            runForumCall(
              forumCall(() =>
                start({
                  connector,
                  redirectUri: connectCallback(window.location, slug),
                  returnPath: RETURN_PATH,
                  slug,
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
                disconnect.withOptimisticUpdate(disconnectSchoolUpdate)({
                  connectionId: connection.id,
                  slug,
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
            (connector) => GOOGLE_MANIFEST[connector].owner === "school"
          )}
        />
      </ConnectorActionsContext>
      {Option.exists(classroom, (row) => row.status === "active") ? (
        <ClassroomImport />
      ) : null}
    </div>
  );
}
