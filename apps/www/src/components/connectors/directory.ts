import {
  GOOGLE_MANIFEST,
  GoogleConnector,
} from "@repo/backend/confect/connectors/google/manifest";
import { ConnectionView } from "@repo/backend/confect/connectors/schema";
import { Array as Arr, Option, Schema } from "effect";
import {
  type Connection,
  currentConnection,
} from "@/components/connectors/optimistic";
import {
  type ConnectSearch,
  connectFailure,
} from "@/components/connectors/outcome";
import { matchesSearch } from "@/components/shared/table/search";

/** What a service is for, which the directory's filter reads. */
export const DirectoryCategory = Schema.Literals([
  "files",
  "learning",
  "schedule",
]);

/**
 * One service of the directory. `connector` is the connection it reads through: Forms has none of
 * its own, because a picked form is read through Drive (ADR 0015). `provider` is the maker's name,
 * which no language translates.
 */
const DirectoryService = Schema.Struct({
  category: DirectoryCategory,
  connector: GoogleConnector,
  key: Schema.Literals(["calendar", "classroom", "drive", "forms"]),
  provider: Schema.Literals(["Google"]),
});
type DirectoryService = typeof DirectoryService.Type;

/** The services a school's directory lists, in the order they show. A new one joins by one line. */
export const DIRECTORY_SERVICES = [
  {
    category: "learning",
    connector: "classroom",
    key: "classroom",
    provider: "Google",
  },
  {
    category: "learning",
    connector: "drive",
    key: "forms",
    provider: "Google",
  },
  { category: "files", connector: "drive", key: "drive", provider: "Google" },
  {
    category: "schedule",
    connector: "calendar",
    key: "calendar",
    provider: "Google",
  },
] as const satisfies readonly DirectoryService[];

/** Whether the school holds a service, or the person who connects it. */
export const holderOf = (service: DirectoryService) =>
  GOOGLE_MANIFEST[service.connector].owner;

/**
 * The services an account lists: those a person holds, each through a connection of its own. Forms
 * reads through Drive to turn a form into an exam, so it stays with a school.
 */
export const ACCOUNT_SERVICES = Arr.filter(
  DIRECTORY_SERVICES,
  (service) =>
    holderOf(service) === "personal" && service.key === service.connector
);

/** The categories a filter offers for `services`, in the order they first show. */
export const directoryCategories = (services: readonly DirectoryService[]) =>
  Arr.dedupe(Arr.map(services, (service) => service.category));

/** Where a service stands for the viewer. */
const ServiceState = Schema.Literals([
  "connected",
  "failed",
  "locked",
  "open",
  "reconnect",
  "refused",
  "soon",
]);

/** One card's worth of the directory: the service, its connection, and where it stands, once read. */
export const DirectoryEntry = Schema.Struct({
  connection: Schema.Option(ConnectionView),
  service: DirectoryService,
  state: Schema.Option(ServiceState),
});

/** The states from which a press starts a first connect. */
export const CONNECTABLE = [
  "failed",
  "open",
  "refused",
] as const satisfies readonly (typeof ServiceState.Type)[];

/** The states that ask for the reader's attention. */
export const LOST = [
  "failed",
  "reconnect",
  "refused",
] as const satisfies readonly (typeof ServiceState.Type)[];

/**
 * Where a service stands for the viewer. A connection decides first, so a service the deployment
 * stopped offering can still be ended. Without one, a service the deployment does not offer yet
 * waits, one the viewer may not connect is locked, and one whose connect just ended badly says so.
 */
export const directoryState = ({
  connection,
  failure,
  isOffered,
  mayConnect,
}: {
  connection: Option.Option<Connection>;
  failure: Option.Option<"failed" | "refused">;
  isOffered: boolean;
  mayConnect: boolean;
}) => {
  if (Option.isSome(connection)) {
    return connection.value.status === "reconnect"
      ? ("reconnect" as const)
      : ("connected" as const);
  }
  if (!isOffered) {
    return "soon" as const;
  }
  if (!mayConnect) {
    return "locked" as const;
  }
  return Option.getOrElse(failure, () => "open" as const);
};

/** The connection a service shows, among the school's and the viewer's own. */
export const serviceConnection = (
  service: DirectoryService,
  held: {
    readonly own: readonly Connection[];
    readonly school: readonly Connection[];
  }
) =>
  currentConnection(
    holderOf(service) === "school" ? held.school : held.own,
    service.connector
  );

/**
 * One entry for each of `services`, once `hasRead` says the reads answered: until then an entry has
 * no state, so a card draws in the first frame and fills it in place. A service a person holds is
 * theirs to connect, and `mayConnectSchool` says whether the viewer may connect the school's own.
 */
export const directoryEntries = ({
  hasRead,
  held,
  mayConnectSchool,
  offered,
  services,
  tried,
}: {
  hasRead: boolean;
  held: Parameters<typeof serviceConnection>[1];
  mayConnectSchool: boolean;
  offered: readonly GoogleConnector[];
  services: readonly DirectoryService[];
  tried: typeof ConnectSearch.Type;
}) =>
  Arr.map(services, (service) => {
    const connection = serviceConnection(service, held);

    return {
      connection,
      service,
      state: hasRead
        ? Option.some(
            directoryState({
              connection,
              failure: connectFailure(tried, service.connector),
              isOffered: Arr.contains(offered, service.connector),
              mayConnect: holderOf(service) === "personal" || mayConnectSchool,
            })
          )
        : Option.none(),
    };
  });

/** Whether any of a service's words holds what the viewer searched for, in the chosen category. */
export const isShown = (
  service: DirectoryService,
  category: Option.Option<typeof DirectoryCategory.Type>,
  search: string,
  words: readonly string[]
) =>
  (Option.isNone(category) || Option.contains(category, service.category)) &&
  Arr.some(words, (word) => matchesSearch(word, search));
