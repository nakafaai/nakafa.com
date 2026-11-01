import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { GOOGLE_MANIFEST } from "@repo/backend/confect/connectors/google/manifest";
import { cn } from "cn";
import { Array as Arr, Effect, Option } from "effect";
import { use } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  ConnectOutcomeContext,
  ConnectorActionsContext,
} from "@/components/connectors/actions";
import { connectCallback } from "@/components/connectors/address";
import {
  DIRECTORY_SERVICES,
  directoryState,
  holderOf,
  matchesSearch,
  serviceConnection,
} from "@/components/connectors/directory";
import {
  CONNECTION_PAGE_SIZE,
  disconnectOwnUpdate,
  disconnectSchoolUpdate,
} from "@/components/connectors/optimistic";
import { contentWidthVariants } from "@/components/shared/content/width";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ServiceCard } from "@/components/tenant/connectors/card";
import { useTenant } from "@/components/tenant/context";
import { isLostAccess } from "@/components/tenant/refusal";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";

/** The page of the school's connections that a school connect returns to. */
const RETURN_PATH = "/settings/connections";

/**
 * The school's connectors as a directory: one header with the search, and one card per service in
 * two columns, which reads the same with four services or twenty.
 */
export function SchoolConnectionsSettings() {
  const t = useTranslations("Connectors");

  return (
    <TableFiltersProvider>
      <SchoolSettingsHeader>
        <TableSearch placeholder={t("search")} />
      </SchoolSettingsHeader>
      <div
        className={cn(contentWidthVariants({ width: "page" }), "w-full p-4")}
      >
        <SchoolDirectory />
      </div>
    </TableFiltersProvider>
  );
}

/**
 * The services of the school (journey J7). Classroom is the school's, which its Owner or Admin
 * connects at the school's own callback; Drive, Forms and Calendar are the viewer's own, which come
 * back to the viewer's account settings on the main site, because a personal connect belongs to no
 * school (ADR 0015). The cards draw with the first frame, and each fills its state as the reads
 * answer, so nothing moves.
 */
function SchoolDirectory() {
  const t = useTranslations("Connectors");
  const locale = useLocale();
  const { reach, slug } = useTenant();
  const search = useTableFilters((state) => state.search);
  const refused = use(ConnectOutcomeContext) === "refused";
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const maySee = Arr.contains(reach, "connection.view");
  const offered = useQuery(connectors.google.offered, isSettled ? {} : "skip");
  const school = usePaginatedQuery(
    connectors.connections.listSchool,
    isSettled && maySee ? { slug } : "skip",
    { initialNumItems: CONNECTION_PAGE_SIZE }
  );
  const own = usePaginatedQuery(
    connectors.connections.listOwn,
    isSettled ? {} : "skip",
    { initialNumItems: CONNECTION_PAGE_SIZE }
  );
  const startSchool = useMutation(connectors.google.startSchool);
  const startPersonal = useMutation(connectors.google.startPersonal);
  const disconnectSchool = useMutation(connectors.connections.disconnectSchool);
  const disconnectOwn = useMutation(connectors.connections.disconnectOwn);

  if (PaginatedQueryResult.isFailure(school) && isLostAccess(school.error)) {
    throw school.error;
  }
  if (
    QueryResult.isFailure(offered) ||
    PaginatedQueryResult.isFailure(school) ||
    PaginatedQueryResult.isFailure(own)
  ) {
    return <DataFailure onRetry={reloadPage} />;
  }

  const hasRead =
    QueryResult.isSuccess(offered) &&
    own._tag !== "LoadingFirstPage" &&
    (!maySee || school._tag !== "LoadingFirstPage");
  const held = { own: own.results, school: school.results };
  const shown = Arr.filter(DIRECTORY_SERVICES, (service) =>
    matchesSearch(search, [
      t(service.key),
      t(`${service.key}-line`),
      t(`holder-${holderOf(service)}`),
    ])
  );

  if (Arr.isReadonlyArrayEmpty(shown)) {
    return (
      <TableEmpty
        act="searching"
        description={t("search-none-description")}
        title={t("search-none")}
      />
    );
  }

  return (
    <ConnectorActionsContext
      value={{
        connect: (connector) => {
          const redirectUri = connectCallback(window.location, slug);
          return runForumCall(
            forumCall(() =>
              GOOGLE_MANIFEST[connector].owner === "school"
                ? startSchool({
                    connector,
                    redirectUri,
                    returnPath: RETURN_PATH,
                    slug,
                  })
                : startPersonal({
                    connector,
                    redirectUri,
                    returnPath: `/${locale}/user/settings/connectors`,
                  })
            ).pipe(
              Effect.tap(({ url }) =>
                Effect.sync(() => window.location.assign(url))
              )
            ),
            toastForumFailure
          );
        },
        disconnect: (connection) =>
          runForumCall(
            forumCall(() =>
              GOOGLE_MANIFEST[connection.connector].owner === "school"
                ? disconnectSchool.withOptimisticUpdate(disconnectSchoolUpdate)(
                    { connectionId: connection.id, slug }
                  )
                : disconnectOwn.withOptimisticUpdate(disconnectOwnUpdate)({
                    connectionId: connection.id,
                  })
            ),
            toastForumFailure
          ),
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {Arr.map(shown, (service) => {
          const connection = serviceConnection(service, held);
          return (
            <ServiceCard
              connection={connection}
              key={service.key}
              service={service}
              state={
                hasRead
                  ? Option.some(
                      directoryState({
                        connection,
                        isOffered: Arr.contains(
                          offered.value,
                          service.connector
                        ),
                        mayConnect:
                          holderOf(service) === "personal" ||
                          Arr.contains(reach, "connection.create"),
                        refused: refused && holderOf(service) === "school",
                      })
                    )
                  : Option.none()
              }
            />
          );
        })}
      </div>
    </ConnectorActionsContext>
  );
}
