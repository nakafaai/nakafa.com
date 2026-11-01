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

/** The categories the filter offers, in the order their services first show. */
export const DIRECTORY_CATEGORIES = Arr.dedupe(
  Arr.map(DIRECTORY_SERVICES, (service) => service.category)
);

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

/** Whether the school holds a service, or the person who connects it. */
export const holderOf = (service: DirectoryService) =>
  GOOGLE_MANIFEST[service.connector].owner;

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

/** Whether any of a service's words holds what the viewer searched for, in the chosen category. */
export const isShown = (
  service: DirectoryService,
  category: Option.Option<typeof DirectoryCategory.Type>,
  search: string,
  words: readonly string[]
) =>
  (Option.isNone(category) || Option.contains(category, service.category)) &&
  Arr.some(words, (word) => matchesSearch(word, search));
