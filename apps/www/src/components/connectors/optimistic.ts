import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Array as Arr, Option } from "effect";

/** One connection as its owner's list shows it. */
export type Connection = Ref.Returns<
  typeof connectors.connections.listOwn
>["page"][number];

const { listOwn, listSchool } = connectors.connections;

/** Marks one connection disconnected in every page of `list` that holds it. */
const disconnectIn = (
  localStore: LocalStore.OptimisticLocalStore,
  list: typeof listOwn | typeof listSchool,
  connectionId: Id<"connectorConnections">
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(query.value.value.page, (row) => row.id === connectionId)
    ) {
      localStore.setQuery(
        list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (row) =>
            row.id === connectionId
              ? { ...row, nextSyncAt: null, status: "disconnected" as const }
              : row
          ),
        })
      );
    }
  }
};

/** Shows an account's own connection as disconnected at once. */
export const disconnectOwnUpdate: OptimisticUpdate<
  typeof connectors.connections.disconnectOwn
> = (localStore, args) => {
  disconnectIn(localStore, listOwn, args.connectionId);
};

/** Shows a school's connection as disconnected at once. */
export const disconnectSchoolUpdate: OptimisticUpdate<
  typeof connectors.connections.disconnectSchool
> = (localStore, args) => {
  disconnectIn(localStore, listSchool, args.connectionId);
};

/**
 * The connection a connector card shows: the newest of the connector's that is
 * active or waits to reconnect. A disconnected one shows as none.
 */
export const currentConnection = (
  connections: readonly Connection[],
  connector: Connection["connector"]
) =>
  Arr.findFirst(
    connections,
    (row) => row.connector === connector && row.status !== "disconnected"
  );
