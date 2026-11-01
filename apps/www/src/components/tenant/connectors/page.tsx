import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { GOOGLE_MANIFEST } from "@repo/backend/confect/connectors/google/manifest";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { ItemGroup } from "@repo/design-system/components/ui/item";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Array as Arr, Effect, Option, Schema } from "effect";
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
  DirectoryCategory,
  type DirectoryEntry,
  directoryState,
  holderOf,
  isShown,
  serviceConnection,
} from "@/components/connectors/directory";
import {
  CONNECTION_PAGE_SIZE,
  disconnectOwnUpdate,
  disconnectSchoolUpdate,
} from "@/components/connectors/optimistic";
import {
  connectedService,
  connectFailure,
} from "@/components/connectors/outcome";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ServiceCard } from "@/components/tenant/connectors/card";
import { ServiceDetail } from "@/components/tenant/connectors/detail";
import {
  CATEGORY_FILTER,
  ServiceFilter,
} from "@/components/tenant/connectors/filter";
import { useTenant } from "@/components/tenant/context";
import { isLostAccess } from "@/components/tenant/refusal";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";

/** The page of the school's connections that a school connect returns to. */
const RETURN_PATH = "/settings/connections";

/**
 * The school's connectors as a library: one header with the search and the filter, the services in
 * cards beside the open service's detail, and a sheet in its place on a small screen. A connect that
 * just finished opens its service, where the work it opens waits.
 */
export function SchoolConnectionsSettings() {
  const t = useTranslations("Connectors");
  const tried = use(ConnectOutcomeContext);

  return (
    <TableFiltersProvider>
      <PanesProvider opened={connectedService(tried)} wideFrom="lg">
        <SchoolSettingsHeader>
          <ButtonGroup>
            <TableSearch placeholder={t("search")} />
            <ServiceFilter />
          </ButtonGroup>
        </SchoolSettingsHeader>
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <SchoolDirectory />
        </div>
      </PanesProvider>
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
  const tried = use(ConnectOutcomeContext);
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
    return <LoadFailure onRetry={reloadPage} />;
  }

  const hasRead =
    QueryResult.isSuccess(offered) &&
    own._tag !== "LoadingFirstPage" &&
    (!maySee || school._tag !== "LoadingFirstPage");
  const held = { own: own.results, school: school.results };
  const entries = Arr.map(DIRECTORY_SERVICES, (service) => {
    const connection = serviceConnection(service, held);

    return {
      connection,
      service,
      state: hasRead
        ? Option.some(
            directoryState({
              connection,
              failure: connectFailure(tried, service.connector),
              isOffered: Arr.contains(offered.value, service.connector),
              mayConnect:
                holderOf(service) === "personal" ||
                Arr.contains(reach, "connection.create"),
            })
          )
        : Option.none(),
    };
  });

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
              Arr.some(school.results, ({ id }) => id === connection.id)
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
      <Panes>
        <PanesList>
          <ServiceList entries={entries} />
        </PanesList>
        <PanesDetail empty={t("detail-empty")} label={t("detail")}>
          <ServiceDetail entries={entries} />
        </PanesDetail>
      </Panes>
    </ConnectorActionsContext>
  );
}

/**
 * The services the search and the filter keep, in two columns of one card size while the pane has
 * the room, so a new connector only adds a card, and a pane that narrows only folds them into one.
 */
function ServiceList({
  entries,
}: {
  entries: readonly (typeof DirectoryEntry.Type)[];
}) {
  const t = useTranslations("Connectors");
  const search = useTableFilters((state) => state.search);
  const chosen = useTableFilters((state) => state.chosen);
  const category = chosenOne(
    chosen,
    CATEGORY_FILTER,
    Schema.is(DirectoryCategory)
  );
  const shown = Arr.filter(entries, ({ service }) =>
    isShown(service, category, search, [
      t(service.key),
      t(`${service.key}-line`),
      t(`holder-${holderOf(service)}`),
      service.provider,
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
    <ScrollArea className="min-h-0 flex-1">
      <div className="@container p-4">
        <ItemGroup className="grid auto-rows-fr gap-4 @xl:grid-cols-2">
          {Arr.map(shown, (entry) => (
            <ServiceCard entry={entry} key={entry.service.key} />
          ))}
        </ItemGroup>
      </div>
    </ScrollArea>
  );
}
