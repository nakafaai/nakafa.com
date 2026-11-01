import {
  GOOGLE_MANIFEST,
  type GoogleConnector,
} from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr, Option, String as Str } from "effect";
import {
  type Connection,
  currentConnection,
} from "@/components/connectors/optimistic";

/**
 * The services a school's directory lists, in the order they show. `connector` is the connection
 * a service reads through: Forms has none of its own, because a picked form is read through Drive
 * (ADR 0015). A new service joins by one line here.
 */
export const DIRECTORY_SERVICES = [
  { connector: "classroom", key: "classroom" },
  { connector: "drive", key: "forms" },
  { connector: "drive", key: "drive" },
  { connector: "calendar", key: "calendar" },
] as const satisfies readonly {
  readonly connector: GoogleConnector;
  readonly key: string;
}[];

/** One service of the directory. */
export type DirectoryService = (typeof DIRECTORY_SERVICES)[number];

/** Whether the school holds a service, or the person who connects it. */
export const holderOf = (service: DirectoryService) =>
  GOOGLE_MANIFEST[service.connector].owner;

/**
 * Where a service stands for the viewer. A connection decides first, so a service the deployment
 * stopped offering can still be ended. Without one, a service the deployment does not offer yet
 * waits, one the viewer may not connect is locked, and one that Google just refused says so.
 */
export const directoryState = ({
  connection,
  isOffered,
  mayConnect,
  refused,
}: {
  connection: Option.Option<Connection>;
  isOffered: boolean;
  mayConnect: boolean;
  refused: boolean;
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
  return refused ? ("refused" as const) : ("open" as const);
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

/** Whether any of a service's words holds what the viewer searched for, in any case. */
export const matchesSearch = (search: string, words: readonly string[]) => {
  const wanted = Str.toLowerCase(Str.trim(search));

  return Arr.some(words, (word) => Str.includes(wanted)(Str.toLowerCase(word)));
};
