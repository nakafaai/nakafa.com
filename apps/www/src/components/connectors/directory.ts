import {
  GOOGLE_MANIFEST,
  GoogleConnector,
} from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr, Option, Schema, String as Str } from "effect";
import {
  type Connection,
  currentConnection,
} from "@/components/connectors/optimistic";

/**
 * One service of the directory. `connector` is the connection it reads through: Forms has none of
 * its own, because a picked form is read through Drive (ADR 0015).
 */
export const DirectoryService = Schema.Struct({
  connector: GoogleConnector,
  key: Schema.Literals(["calendar", "classroom", "drive", "forms"]),
});
export type DirectoryService = typeof DirectoryService.Type;

/** The services a school's directory lists, in the order they show. A new one joins by one line. */
export const DIRECTORY_SERVICES = [
  { connector: "classroom", key: "classroom" },
  { connector: "drive", key: "forms" },
  { connector: "drive", key: "drive" },
  { connector: "calendar", key: "calendar" },
] as const satisfies readonly DirectoryService[];

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

/** Whether any of a service's words holds what the viewer searched for, in any case. */
export const matchesSearch = (search: string, words: readonly string[]) => {
  const wanted = Str.toLowerCase(Str.trim(search));

  return Arr.some(words, (word) => Str.includes(wanted)(Str.toLowerCase(word)));
};
